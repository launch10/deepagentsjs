import { Context } from 'hono';
import { Env } from '../../types';
import { updateFirewallList } from '../../utils/cloudflareApi';
import { serveAssetFromR2 } from '../../r2Assets';
import { DurableObject, DurableObjectState } from '@cloudflare/workers-types';
import { scopedLogger, getSiteName } from './utils';
import { KVCache } from './kvCache';

export class FirewallDO implements DurableObject {
  state: DurableObjectState;
  env: Env;
  count: number = 0;
  siteName: string | null = null;
  kvCache: KVCache;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.kvCache = new KVCache();
    
    // Initialize count from storage
    this.state.blockConcurrencyWhile(async () => {
      this.count = await this.state.storage.get<number>('count') || 0;
      this.siteName = await this.state.storage.get<string>('siteName') || null;
    });
  }

  // just to make the type checker happy
  async fetch(request: Request): Promise<Response> {
    return new Response('ok');
  }

  async maybeActivateFirewall(c: Context<{ Bindings: Env }>, tenantId: string): Promise<boolean> {
    try {
      // If this is the first request for this site, initialize approximate count from KV
      if (this.count === 0) {
        const kvRequestCount = await this.kvCache.getRequestCount(c, tenantId);
        await this.state.storage.put('count', kvRequestCount + 1);
      } else {
        this.count++;
        await this.state.storage.put('count', this.count);
      }
      
      const tenantsLimit = await this.kvCache.getTenantsLimit(c, tenantId);
      if (this.count > tenantsLimit) {
        scopedLogger.info(`LIMIT BREACHED for ${this.siteName}. Adding to Firewall list.`);
        
        // Fire-and-forget the API call to block the hostname
        const tenantsProperties = await this.kvCache.listTenantsProperties(c, tenantId);
        tenantsProperties.forEach(property => {
          this.state.waitUntil(
            updateFirewallList(c.env, property, 'add')
          );
        });
        
        return true;
      }
      return false;
    } catch (error: any) {
      // if we break this code, it could have catastrophic consequences,
      // so we should err on the side of caution and block the site
      return true;
    }
  }
}