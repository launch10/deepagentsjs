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
        const tenantId = await this.kvCache.getTenantId(c);
        const shouldRateLimit = await this.shouldRateLimit(c, tenantId);

        if (shouldRateLimit) {
          scopedLogger.debug(`rateLimiting!`);
          return c.json({ error: 'Rate limit exceeded' }, 429);
        }

        await this.updateRequestCount(c, tenantId);
        return next();
    }

    private async shouldRateLimit(c: Context<{ Bindings: Env }>, tenantId: string): Promise<boolean> {
      const status = await this.kvCache.getTenantStatus(c, tenantId); // global estimate (not just local cache), kv reads are fast and cheap
      scopedLogger.debug(`status: ${status}`);

      if (status === 'monitoring') {
        const durableObject = await this.getDurableObject(c, tenantId);
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
    private async getDurableObject(c: Context<{ Bindings: Env }>, tenantId: string): Promise<DurableObject> {
      const doId = c.env.RATE_LIMITER.idFromName(tenantId);
      const durableObject = c.env.RATE_LIMITER.get(doId);
      return durableObject;
    }

    private async updateRequestCount(c: Context<{ Bindings: Env }>, tenantId: string) {
      let currentCount = this.memoryCache.incrementRequestCount(c, tenantId);

      scopedLogger.debug(`currentCount: ${currentCount}`);

      if (currentCount % this.batchSize === 0) {
        scopedLogger.debug(`writing to KV for ${c.req.url}`);
        const newTotal = await this.kvCache.incrementBy(c, tenantId, currentCount);
        this.memoryCache.resetRequestCount(c, tenantId);

        if (await this.didCrossThreshold(c, tenantId, newTotal)) {
          await this.afterThresholdCrossed(c, tenantId);
        }
      }
    }

    private async didCrossThreshold(c: Context<{ Bindings: Env }>, tenantId: string, newTotal: number): Promise<boolean> {
      const tenantsLimit = await this.kvCache.getTenantsLimit(c, tenantId);
      const monitoringThreshold = tenantsLimit * usageThresholdPercent;

      return newTotal > monitoringThreshold;
    }

    private async afterThresholdCrossed(c: Context<{ Bindings: Env }>, tenantId: string) {
      scopedLogger.debug(`Tenant ${tenantId} crossed threshold. Activating monitoring.`);
      this.kvCache.setTenantStatus(c, tenantId, 'monitoring');
    }
}

const rateLimiter = new RateLimiter();

export const rateLimiterMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  return rateLimiter.fetch(c, next);
};
