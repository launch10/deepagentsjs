import { Context } from 'hono';
import { Env } from '~/types';
import { scopedLogger } from './utils';

export class MemoryCache {
    private cache: Map<string, number>;
    constructor() {
        this.cache = new Map();
    }
    
    getRequestCount(c: Context<{ Bindings: Env }>, accountId: string): number {
      const count = this.cache.get(accountId) || 0;
      scopedLogger.debug(`count: ${count}`);

      return count;
    }
    
    incrementRequestCount(c: Context<{ Bindings: Env }>, accountId: string): number {
      const count = this.getRequestCount(c, accountId);
      this.cache.set(accountId, count + 1);

      return count + 1;
    }

    resetRequestCount(c: Context<{ Bindings: Env }>, accountId: string): void {
      this.cache.set(accountId, 0);
    }
}