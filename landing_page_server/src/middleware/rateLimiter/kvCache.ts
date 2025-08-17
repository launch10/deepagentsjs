import { Context } from 'hono';
import { Env } from '~/types';
import { scopedLogger, getSiteName } from './utils';

export class KVCache {
    private cache: Map<string, number>;
    constructor() {
        this.cache = new Map();
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