import { Context } from 'hono';
import { Env } from '~/types';
import { scopedLogger } from './utils';

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

    async setTenantsPlan(c: Context<{ Bindings: Env }>, tenantId: string, plan: Plan): Promise<void> {
      scopedLogger.debug(`setting plan: ${plan}`);

      await c.executionCtx.waitUntil(
        c.env.USAGE_LIMIT.put(`plan:${tenantId}`, plan)
      );
    }

    async getTenantsPlan(c: Context<{ Bindings: Env }>, tenantId: string): Promise<Plan> {
      const plan = await c.env.USAGE_LIMIT.get(`plan:${tenantId}`) || 'starter';
      scopedLogger.debug(`plan: ${plan}`);

      return plan as Plan;
    }

    async getTenantsLimit(c: Context<{ Bindings: Env }>, tenantId: string): Promise<number> {
      const plan = await this.getTenantsPlan(c, tenantId);
      const limit = MonthlyPlanLimit[plan];
      scopedLogger.debug(`limit: ${limit}`);

      return limit;
    }

    async setTenantId(c: Context<{ Bindings: Env }>, tenantId: string, url: string): Promise<void> {
      await c.executionCtx.waitUntil(
        c.env.USAGE_LIMIT.put(`tenantId:${url}`, tenantId)
      );
    }
    
    async getTenantId(c: Context<{ Bindings: Env }>): Promise<string> {
      const url = new URL(c.req.url).hostname;
      const tenantId = await c.env.USAGE_LIMIT.get(`tenantId:${url}`);

      if (!tenantId) {
        throw new Error(`Tenant ID not found for URL: ${url}`);
      }

      scopedLogger.debug(`tenantId: ${tenantId}`);

      return tenantId;
    }
    
    async getTenantStatus(c: Context<{ Bindings: Env }>, tenantId: string): Promise<string> {
      const status = await c.env.USAGE_LIMIT.get(`status:${tenantId}`) || 'normal';
      scopedLogger.debug(`status: ${status}`);

      return status;
    }
    
    async setTenantStatus(c: Context<{ Bindings: Env }>, tenantId: string, status: string): Promise<void> {
      scopedLogger.debug(`setting status: ${status}`);

      await c.executionCtx.waitUntil(
        c.env.USAGE_LIMIT.put(`status:${tenantId}`, status)
      );
    }

    async getRequestCount(c: Context<{ Bindings: Env }>, tenantId: string): Promise<number> {
      const count = parseInt(await c.env.USAGE_LIMIT.get(`count:${tenantId}`) || '0') as number;
      scopedLogger.debug(`count: ${count}`);

      return count;
    }

    async incrementBy(c: Context<{ Bindings: Env }>, tenantId: string, amount: number): Promise<number> {
      scopedLogger.debug(`incrementing by ${amount}`);

      const prevCount = await this.getRequestCount(c, tenantId);
      const newCount = prevCount + amount;

      await c.executionCtx.waitUntil(  
        c.env.USAGE_LIMIT.put(`count:${tenantId}`, newCount.toString())
      );

      return newCount;
    }

    async resetRequestCount(c: Context<{ Bindings: Env }>, tenantId: string): Promise<void> {
      await c.env.USAGE_LIMIT.put(`count:${tenantId}`, '0');
    }
}