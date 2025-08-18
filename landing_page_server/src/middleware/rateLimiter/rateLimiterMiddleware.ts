import { Context, MiddlewareHandler, Next } from 'hono';
import { usageThresholdPercent, Env, SiteType, TenantType } from '~/types';
import { scopedLogger } from './utils';
import { RequestContext } from './kvCache';
import { MemoryCache } from './memoryCache';
import { Tenant } from '~/models/tenant';
import { Site } from '~/models/site';

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

      await this.updateRequestCount(c, tenantId);
      return next();
    }

    private async shouldRateLimit(c: Context<{ Bindings: Env }>): Promise<boolean> {
      const siteModel = new Site(c);
      const site = await siteModel.findByUrl(c.req.url);

      if (!site) {
        throw new Error(`Site not found for URL: ${c.req.url}`);
      }

      const tenantId = site.tenantId;
      const tenantModel = new Tenant(c);
      const tenant = await tenantModel.get(tenantId);

      if (!tenant) {
        throw new Error(`Tenant not found for ID: ${tenantId}`);
      }

      const status = await this.kvCache.getTenantStatus(c, tenantId); // global estimate (not just local cache), kv reads are fast and cheap
      scopedLogger.debug(`status: ${status}`);

      if (status === 'monitoring' || status === 'blocked') {
        const durableObject = await this.getDurableObject(c, tenantId);
        const shouldBlock = await durableObject.maybeActivateFirewall(c, tenantId);
        return shouldBlock;
      } else {
        return false;
      }
    }

    // See RateLimiterDO to see the actual implementation
    private async getDurableObject(c: Context<{ Bindings: Env }>, tenantId: string): Promise<RateLimiterDO> {
      const doId = c.env.FIREWALL.idFromName(tenantId);
      const durableObject = c.env.FIREWALL.get(doId) as FirewallDO;
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
