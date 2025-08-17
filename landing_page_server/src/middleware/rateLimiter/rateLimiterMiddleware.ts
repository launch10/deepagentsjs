import { Context, MiddlewareHandler, Next } from 'hono';
import { getTenantInfo } from '@utils/getTenantInfo';
import { DurableObject } from '@cloudflare/workers-types';
import { usageThresholdPercent, Env } from '~/types';
import { logger } from '@utils/logger';

const scopedLogger = logger.addScope('rateLimiter');

// Each site might have 10 requests (e.g. images, css, js, etc.)
// So this is closer to "10 page views" than "100 page views"
const BATCH_SIZE = 3;

const getSiteName = (c: Context<{ Bindings: Env }>): string => {
  const tenantInfo = getTenantInfo(c.req.url);
  return tenantInfo.siteName;
}
class MemoryCache {
    private cache: Map<string, number>;
    constructor() {
        this.cache = new Map();
    }
    
    getRequestCount(c: Context<{ Bindings: Env }>): number {
      const siteName = getSiteName(c);
      const count = this.cache.get(siteName) || 0;
      scopedLogger.debug(`count: ${count}`);

      return count;
    }
    
    incrementRequestCount(c: Context<{ Bindings: Env }>): number {
      const siteName = getSiteName(c);
      const count = this.getRequestCount(c);
      this.cache.set(siteName, count + 1);

      return count + 1;
    }

    resetRequestCount(c: Context<{ Bindings: Env }>): void {
      const siteName = getSiteName(c);
      this.cache.set(siteName, 0);
    }
}

class KVCache {
    private cache: Map<string, number>;
    constructor() {
        this.cache = new Map();
    }
    
    async getSiteStatus(c: Context<{ Bindings: Env }>): Promise<string> {
      const siteName = getSiteName(c);
      const status = await c.env.USAGE_LIMIT.get(`status:${siteName}`) || 'normal';
      scopedLogger.debug(`status: ${status}`);

      return status;
    }
    
    async setSiteStatus(c: Context<{ Bindings: Env }>, status: string): Promise<void> {
      const siteName = getSiteName(c);
      scopedLogger.debug(`setting status: ${status}`);

      await c.executionCtx.waitUntil(
        c.env.USAGE_LIMIT.put(`status:${siteName}`, status)
      );
    }

    async getRequestCount(c: Context<{ Bindings: Env }>): Promise<number> {
      const siteName = getSiteName(c);
      const count = parseInt(await c.env.USAGE_LIMIT.get(`count:${siteName}`) || '0') as number;
      scopedLogger.debug(`count: ${count}`);

      return count;
    }

    async incrementBy(c: Context<{ Bindings: Env }>, amount: number): Promise<number> {
      const siteName = getSiteName(c);
      scopedLogger.debug(`incrementing by ${amount}`);

      const prevCount = await this.getRequestCount(c);
      const newCount = prevCount + amount;

      await c.executionCtx.waitUntil(  
        c.env.USAGE_LIMIT.put(`count:${siteName}`, newCount.toString())
      );

      return newCount;
    }
}
class RateLimiter {
    private batchSize: number;
    private kvCache: KVCache;
    private memoryCache: MemoryCache;
    
    constructor() {
        this.memoryCache = new MemoryCache();
        this.batchSize = BATCH_SIZE;
        this.kvCache = new KVCache();
    }

    async fetch(c: Context<{ Bindings: Env }>, next: Next) {
        const shouldRateLimit = await this.shouldRateLimit(c);

        if (shouldRateLimit) {
          scopedLogger.debug(`rateLimiting!`);
            return c.json({ error: 'Rate limit exceeded' }, 429);
        }

        await this.updateRequestCount(c, next);
        return next();
    }

    private async shouldRateLimit(c: Context<{ Bindings: Env }>): Promise<boolean> {
      const status = await this.kvCache.getSiteStatus(c); // global estimate (not just local cache), kv reads are fast and cheap

      if (status === 'monitoring') {
        const siteName = getSiteName(c);
        const durableObject = this.getDurableObject(c);
        const response = await durableObject.fetch(siteName);
        return response.ok;
      } else {
        return false;
      }
    }

    // See RateLimiterDO to see the actual implementation
    private getDurableObject(c: Context<{ Bindings: Env }>): DurableObject {
      // We don't want t a DO per tenant, we wnat it per site
      // REFINE THIS BEFORE PROD
      const siteName = getSiteName(c);
      const doId = c.env.RATE_LIMITER.idFromName(siteName);
      const durableObject = c.env.RATE_LIMITER.get(doId);
      return durableObject;
    }

    private async updateRequestCount(c: Context<{ Bindings: Env }>, next: Next) {
      let currentCount = this.memoryCache.incrementRequestCount(c);

      scopedLogger.debug(`currentCount: ${currentCount}`);

      if (currentCount % this.batchSize === 0) {
        scopedLogger.debug(`writing to KV for ${c.req.url}`);
        const newTotal = await this.kvCache.incrementBy(c, currentCount);
        this.memoryCache.resetRequestCount(c);

        if (this.didCrossThreshold(newTotal)) {
          await this.afterThresholdCrossed(c, next);
        }
      }
    }

    private didCrossThreshold(newTotal: number) {
      const monitoringThreshold = newTotal * usageThresholdPercent;
      return newTotal > monitoringThreshold;
    }

    private async afterThresholdCrossed(c: Context<{ Bindings: Env }>, next: Next) {
      scopedLogger.debug(`Tenant ${c.env.RATE_LIMITER.idFromName(c.req.url)} crossed threshold. Activating monitoring.`);
      this.kvCache.setSiteStatus(c, 'monitoring');
    }
}

const rateLimiter = new RateLimiter();

export const rateLimiterMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  return rateLimiter.fetch(c, next);
};
