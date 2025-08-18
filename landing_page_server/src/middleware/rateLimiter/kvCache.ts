import { Context } from 'hono';
import { Env } from '~/types';
import { scopedLogger } from './utils';
import { Tenant } from '~/models/tenant';
import { Site } from '~/models/site';

type Plan = "starter" | "pro" | "enterprise";
const MonthlyPlanLimit = {
    starter: 1_000_000,
    pro: 5_000_000,
    enterprise: 20_000_000
}
export class RequestContext {
    async setTenantsPlan(c: Context<{ Bindings: Env }>, tenantId: string, plan: Plan): Promise<void> {
      scopedLogger.debug(`setting plan: ${plan}`);

      await c.executionCtx.waitUntil(
        c.env.DEPLOYS_KV.put(`plan:${tenantId}`, plan)
      );
    }

    async getTenantsPlan(c: Context<{ Bindings: Env }>, tenantId: string): Promise<Plan> {
      const tenant = await (new Tenant(c)).get(tenantId);
      const plan = await c.env.DEPLOYS_KV.get(`plan:${tenantId}`) || 'starter';
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
        c.env.DEPLOYS_KV.put(`tenantId:${url}`, tenantId)
      );
      await c.executionCtx.waitUntil(
        c.env.DEPLOYS_KV.put(`tenant:${tenantId}:url:`, url)
      );
    }

    async listTenantsProperties(c: Context<{ Bindings: Env }>, tenantId: string): Promise<string[]> {
      const properties = await c.env.DEPLOYS_KV.list({ prefix: `tenant:${tenantId}:url:` });
      const urls = await Promise.all(
        properties.keys.map(key => c.env.DEPLOYS_KV.get(key.name))
      );
      return urls.filter(url => url !== null) as string[];
    }
    
    async getTenantId(c: Context<{ Bindings: Env }>): Promise<string> {
      const url = new URL(c.req.url).hostname;
      const site = await (new Site(c)).get(url);
      const tenantId = await c.env.DEPLOYS_KV.get(`tenantId:${url}`);

      if (!tenantId) {
        throw new Error(`Tenant ID not found for URL: ${url}`);
      }

      scopedLogger.debug(`tenantId: ${tenantId}`);

      return tenantId;
    }
    
    async getTenantStatus(c: Context<{ Bindings: Env }>, tenantId: string): Promise<string> {
      const status = await c.env.DEPLOYS_KV.get(`status:${tenantId}`) || 'normal';
      scopedLogger.debug(`status: ${status}`);

      return status;
    }
    
    async setTenantStatus(c: Context<{ Bindings: Env }>, tenantId: string, status: string): Promise<void> {
      scopedLogger.debug(`setting status: ${status}`);

      await c.executionCtx.waitUntil(
        c.env.DEPLOYS_KV.put(`status:${tenantId}`, status)
      );
    }

    async getRequestCount(c: Context<{ Bindings: Env }>, tenantId: string): Promise<number> {
      const count = parseInt(await c.env.DEPLOYS_KV.get(`count:${tenantId}`) || '0') as number;
      scopedLogger.debug(`count: ${count}`);

      return count;
    }

    async incrementBy(c: Context<{ Bindings: Env }>, tenantId: string, amount: number): Promise<number> {
      scopedLogger.debug(`incrementing by ${amount}`);

      const prevCount = await this.getRequestCount(c, tenantId);
      const newCount = prevCount + amount;

      await c.executionCtx.waitUntil(  
        c.env.DEPLOYS_KV.put(`count:${tenantId}`, newCount.toString())
      );

      return newCount;
    }

    async resetRequestCount(c: Context<{ Bindings: Env }>, tenantId: string): Promise<void> {
      await c.env.DEPLOYS_KV.put(`count:${tenantId}`, '0');
    }
}