import { Context } from 'hono';
import { Env } from '~/types';
import { scopedLogger, getSiteName } from './utils';

type Plan = "starter" | "pro" | "enterprise";
const MonthlyPlanLimit = {
    starter: 1_000_000,
    pro: 5_000_000,
    enterprise: 20_000_000
}
export class KVCache {
    private cache: Map<string, number>;
    constructor() {
        this.cache = new Map();
    }

    async setTenantsPlan(c: Context<{ Bindings: Env }>, plan: Plan): Promise<void> {
      const tenantId = await this.getTenantId(c);
      scopedLogger.debug(`setting plan: ${plan}`);

      await c.executionCtx.waitUntil(
        c.env.USAGE_LIMIT.put(`plan:${tenantId}`, plan)
      );
    }

    async getTenantsPlan(c: Context<{ Bindings: Env }>): Promise<Plan> {
      const tenantId = await this.getTenantId(c);
      const plan = await c.env.USAGE_LIMIT.get(`plan:${tenantId}`) || 'starter';
      scopedLogger.debug(`plan: ${plan}`);

      return plan as Plan;
    }

    async getTenantsLimit(c: Context<{ Bindings: Env }>): Promise<number> {
      const plan = await this.getTenantsPlan(c);
      const limit = MonthlyPlanLimit[plan];
      scopedLogger.debug(`limit: ${limit}`);

      return limit;
    }

    async setTenantId(c: Context<{ Bindings: Env }>): Promise<void> {
      const siteName = new URL(c.req.url).hostname;
      scopedLogger.debug(`setting tenantId: ${siteName}`);

      await c.executionCtx.waitUntil(
        c.env.USAGE_LIMIT.put(`tenantId:${siteName}`, siteName)
      );
    }
    
    async getTenantId(c: Context<{ Bindings: Env }>): Promise<string> {
      const siteName = new URL(c.req.url).hostname;
      const tenantId = await c.env.USAGE_LIMIT.get(`tenantId:${siteName}`) || 'normal';
      scopedLogger.debug(`tenantId: ${tenantId}`);

      return tenantId;
    }
    
    async getTenantStatus(c: Context<{ Bindings: Env }>): Promise<string> {
      const tenantId = await this.getTenantId(c);
      const status = await c.env.USAGE_LIMIT.get(`status:${tenantId}`) || 'normal';
      scopedLogger.debug(`status: ${status}`);

      return status;
    }
    
    async setTenantStatus(c: Context<{ Bindings: Env }>, status: string): Promise<void> {
      const tenantId = await this.getTenantId(c);
      scopedLogger.debug(`setting status: ${status}`);

      await c.executionCtx.waitUntil(
        c.env.USAGE_LIMIT.put(`status:${tenantId}`, status)
      );
    }

    async getRequestCount(c: Context<{ Bindings: Env }>): Promise<number> {
      const tenantId = await this.getTenantId(c);
      const count = parseInt(await c.env.USAGE_LIMIT.get(`count:${tenantId}`) || '0') as number;
      scopedLogger.debug(`count: ${count}`);

      return count;
    }

    async incrementBy(c: Context<{ Bindings: Env }>, amount: number): Promise<number> {
      const tenantId = await this.getTenantId(c);
      scopedLogger.debug(`incrementing by ${amount}`);

      const prevCount = await this.getRequestCount(c);
      const newCount = prevCount + amount;

      await c.executionCtx.waitUntil(  
        c.env.USAGE_LIMIT.put(`count:${tenantId}`, newCount.toString())
      );

      return newCount;
    }

    async resetRequestCount(c: Context<{ Bindings: Env }>): Promise<void> {
      const tenantId = await this.getTenantId(c);
      await c.env.USAGE_LIMIT.put(`count:${tenantId}`, '0');
    }
}