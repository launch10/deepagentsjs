import { Context, MiddlewareHandler, Next } from 'hono';
import { usageThresholdPercent, Env, TenantType, SiteType, FirewallType } from '~/types';
import { scopedLogger } from './utils';
import { MemoryCache } from './memoryCache';
import { Tenant, Site, Firewall, Request, Plan } from '~/models';
import { v4 as uuidv4 } from 'uuid';

// Each site might have 10 requests (e.g. images, css, js, etc.)
// So this is closer to "10 page views" than "100 page views"
const BATCH_SIZE = 10;
class RateLimiter {
    private batchSize: number;
    private memoryCache: MemoryCache;
    
    constructor() {
        this.memoryCache = new MemoryCache();
        this.batchSize = BATCH_SIZE;
    }

    isDocumentRequest = (url: string): boolean => {
        const path = new URL(url).pathname;
        return path.endsWith('/') || path.endsWith('.html') || path.endsWith('.htm');
    };
    
    async fetch(c: Context<{ Bindings: Env }>, next: Next) {
      if (!this.isDocumentRequest(c.req.url)) return next();

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

      const firewallModel = new Firewall(c);
      const firewall = await firewallModel.findByTenant(tenantId);
      const status = firewall ? firewall.status : 'inactive';
      let shouldBlock;

      if (status === 'monitoring') {
        shouldBlock = await firewallModel.shouldBlock(tenant);
      } else { 
        shouldBlock = status === 'blocked';
      }

      if (shouldBlock) {
        scopedLogger.debug(`rateLimiting!`);
        await firewallModel.block(tenant);
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }

      await this.updateRequestCount(c, tenant);
      return next();
    }

    private async updateRequestCount(c: Context<{ Bindings: Env }>, tenant: TenantType): Promise<void> {
      let currentCount = this.memoryCache.incrementRequestCount(c, tenant.id);

      scopedLogger.debug(`currentCount: ${currentCount}`);

      if (currentCount % this.batchSize === 0) {
        scopedLogger.debug(`writing to KV for ${c.req.url}`);
        const requestModel = new Request(c);
        const requests = await requestModel.findByTenantId(tenant.id);
        const newTotal = (requests?.count || 0) + currentCount;
        
        if (requests) {
            await requestModel.set(requests.id, {...requests, count: newTotal});
        } else {
            const newRequest = { count: newTotal, tenantId: String(tenant.id), id: uuidv4() };
            await requestModel.set(newRequest.id, newRequest);
        }
        this.memoryCache.resetRequestCount(c, tenant.id);

        if (await this.didCrossThreshold(c, tenant, newTotal)) {
          await this.afterThresholdCrossed(c, tenant);
        }
      }
    }

    private async didCrossThreshold(c: Context<{ Bindings: Env }>, tenant: TenantType, newTotal: number): Promise<boolean> {
      const planModel = new Plan(c);
      const plan = await planModel.get(tenant.planId);

      if (!plan) {
        throw new Error(`Plan not found for ID: ${tenant.planId}`);
      }

      const tenantsLimit = planModel.getMonthlyLimit(plan);
      const monitoringThreshold = tenantsLimit * usageThresholdPercent;

      return newTotal > monitoringThreshold;
    }

    private async afterThresholdCrossed(c: Context<{ Bindings: Env }>, tenant: TenantType) {
      scopedLogger.debug(`Tenant ${tenant.id} crossed threshold. Activating monitoring.`);
      const firewallModel = new Firewall(c);
      const existingFirewall = await firewallModel.findByTenant(tenant.id);
      
      if (existingFirewall) {
        // Update existing firewall
        await firewallModel.set(existingFirewall.id, { ...existingFirewall, status: 'monitoring' });
      } else {
        // Create new firewall
        const newFirewall = { id: uuidv4(), tenantId: String(tenant.id), status: 'monitoring' };
        await firewallModel.set(newFirewall.id, newFirewall);
      }
    }
}

const rateLimiter = new RateLimiter();

export const rateLimiterMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  return rateLimiter.fetch(c, next);
};
