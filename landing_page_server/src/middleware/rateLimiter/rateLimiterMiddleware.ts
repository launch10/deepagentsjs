import { Context, MiddlewareHandler, Next } from 'hono';
import { getTenantInfo } from '@utils/getTenantInfo';
import { DurableObject } from '@cloudflare/workers-types';
import { usageThresholdPercent, Env } from '~/types';

// Each site might have 10 requests (e.g. images, css, js, etc.)
// So this is closer to "10 page views" than "100 page views"
const BATCH_SIZE = 100;
class RateLimiter {
    private memoryCache: Map<string, number>;
    private batchSize: number;
    
    constructor() {
        this.memoryCache = new Map();
        this.batchSize = BATCH_SIZE;
    }

    async fetch(c: Context<{ Bindings: Env }>, next: Next) {
        const shouldRateLimit = await this.shouldRateLimit(c, next);
        if (shouldRateLimit) {
            return c.json({ error: 'Rate limit exceeded' }, 429);
        }

        await this.updateRequestCount(c, next);
        return next();
    }

    private getTenantId(c: Context<{ Bindings: Env }>, next: Next): string {
      const tenantInfo = getTenantInfo(c.req.url);
      return tenantInfo.siteName;
    }

    private async shouldRateLimit(c: Context<{ Bindings: Env }>, next: Next): Promise<boolean> {
      const status = await c.env.USAGE_LIMIT.get(`status:${c.env.RATE_LIMITER.idFromName(c.req.url)}`);

      if (status === 'monitoring') {
        const durableObject = this.getDurableObject(c, next);
        const response = await durableObject.fetch(c.req.raw);
        return response.ok;
      } else {
        return false;
      }
    }

    // See RateLimiterDO to see the actual implementation
    private getDurableObject(c: Context<{ Bindings: Env }>, next: Next): DurableObject {
      // We don't want t a DO per tenant, we wnat it per site
      // REFINE THIS BEFORE PROD
      const tenantId = this.getTenantId(c, next);
      const doId = c.env.RATE_LIMITER.idFromName(tenantId);
      const durableObject = c.env.RATE_LIMITER.get(doId);
      return durableObject;
    }

    private async updateRequestCount(c: Context<{ Bindings: Env }>, next: Next) {
      let currentCount = this.memoryCache.get(c.req.url) || 0;
      currentCount++;
      this.memoryCache.set(c.req.url, currentCount);

      if (currentCount % this.batchSize === 0) {
        await this.writeToKV(c, next);
      }

      if (await this.didCrossThreshold(c, next)) {
        await this.afterThresholdCrossed(c, next);
      }
    }

    private async writeToKV(c: Context<{ Bindings: Env }>, next: Next) {
      const totalCount = this.memoryCache.get(c.req.url) || 0;
      const newTotal = totalCount + this.batchSize;

      c.executionCtx.waitUntil(  
        c.env.USAGE_LIMIT.put(
          `count:${c.env.RATE_LIMITER.idFromName(c.req.url)}`, 
          JSON.stringify(newTotal)
        )
      );
    }

    private async didCrossThreshold(c: Context<{ Bindings: Env }>, next: Next) {
      const totalCount = await c.env.USAGE_LIMIT.get<number>(`count:${c.env.RATE_LIMITER.idFromName(c.req.url)}`, { type: 'json' }) || 0;
      const monitoringThreshold = totalCount* usageThresholdPercent;
      return totalCount > monitoringThreshold;
    }

    private async afterThresholdCrossed(c: Context<{ Bindings: Env }>, next: Next) {
      console.log(`Tenant ${c.env.RATE_LIMITER.idFromName(c.req.url)} crossed threshold. Activating DO monitoring.`);
      c.executionCtx.waitUntil(c.env.USAGE_LIMIT.put(`status:${c.env.RATE_LIMITER.idFromName(c.req.url)}`, 'monitoring'));
    }
}

const rateLimiter = new RateLimiter();

export const rateLimiterMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  return rateLimiter.fetch(c, next);
};
