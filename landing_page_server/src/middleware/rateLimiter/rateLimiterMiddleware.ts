import { Context, MiddlewareHandler, Next } from 'hono';
import { DurableObject } from '@cloudflare/workers-types';
import { usageThresholdPercent, Env } from '~/types';
import { scopedLogger, getSiteName } from './utils';
import { KVCache } from './kvCache';
import { MemoryCache } from './memoryCache';

// Each site might have 10 requests (e.g. images, css, js, etc.)
// So this is closer to "10 page views" than "100 page views"
const BATCH_SIZE = 10;
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
      const status = await this.kvCache.getTenantStatus(c); // global estimate (not just local cache), kv reads are fast and cheap
      scopedLogger.debug(`status: ${status}`);

      if (status === 'monitoring') {
        const durableObject = await this.getDurableObject(c);
        // Create a proper Request object for the Durable Object
        const request = new Request(c.req.url, {
          method: c.req.method,
          headers: c.req.raw.headers,
        });
        const response = await durableObject.fetch(request);
        // If DO returns 429, we should rate limit
        return response.status === 429;
      } else {
        return false;
      }
    }

    // See RateLimiterDO to see the actual implementation
    private async getDurableObject(c: Context<{ Bindings: Env }>): Promise<DurableObject> {
      const tenantId = await this.kvCache.getTenantId(c);
      const doId = c.env.RATE_LIMITER.idFromName(tenantId);
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
      const tenantId = await this.kvCache.getTenantId(c);
      scopedLogger.debug(`Tenant ${tenantId} crossed threshold. Activating monitoring.`);
      this.kvCache.setTenantStatus(c, 'monitoring');
    }
}

const rateLimiter = new RateLimiter();

export const rateLimiterMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  return rateLimiter.fetch(c, next);
};
