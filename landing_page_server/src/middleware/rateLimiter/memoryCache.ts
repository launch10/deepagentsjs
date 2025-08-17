import { Context } from 'hono';
import { Env } from '~/types';
import { scopedLogger } from './utils';

export class MemoryCache {
    private cache: Map<string, number>;
    constructor() {
        this.cache = new Map();
    }
    
    getRequestCount(c: Context<{ Bindings: Env }>, tenantId: string): number {
      const count = this.cache.get(tenantId) || 0;
      scopedLogger.debug(`count: ${count}`);

      return count;
    }
    
    incrementRequestCount(c: Context<{ Bindings: Env }>, tenantId: string): number {
      const count = this.getRequestCount(c, tenantId);
      this.cache.set(tenantId, count + 1);

      return count + 1;
    }

    resetRequestCount(c: Context<{ Bindings: Env }>, tenantId: string): void {
      this.cache.set(tenantId, 0);
    }
}