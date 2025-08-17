import { Context } from 'hono';
import { Env } from '~/types';
import { scopedLogger, getSiteName } from './utils';

export class MemoryCache {
    private cache: Map<string, number>;
    constructor() {
        this.cache = new Map();
    }
    
    getRequestCount(c: Context<{ Bindings: Env }>): number {
      const siteName = getSiteName(c);
      const count = this.cache.get(siteName) || 0;
      scopedLogger.debug(`count: ${count}`);

      return count;
    }
    
    incrementRequestCount(c: Context<{ Bindings: Env }>): number {
      const siteName = getSiteName(c);
      const count = this.getRequestCount(c);
      this.cache.set(siteName, count + 1);

      return count + 1;
    }

    resetRequestCount(c: Context<{ Bindings: Env }>): void {
      const siteName = getSiteName(c);
      this.cache.set(siteName, 0);
    }
}