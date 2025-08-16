import { Env, TenantInfo } from '../types';
import { updateFirewallList } from '../cloudflare-api';
import { serveAssetFromR2 } from '../r2Assets';
import { getTenantInfo } from '../utils';
import { DurableObject, DurableObjectState, Request, Response } from '@cloudflare/workers-types';

export class RateLimiter implements DurableObject {
  state: DurableObjectState;
  env: Env;
  count: number = 0;
  tenantId: string | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // Initialize count from storage
    this.state.blockConcurrencyWhile(async () => {
      this.count = await this.state.storage.get<number>('count') || 0;
      this.tenantId = await this.state.storage.get<string>('tenantId') || null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const tenantInfo = getTenantInfo(request.url);
      const currentTenantId = tenantInfo.siteName;

      // If this is a new tenant for this DO instance, reset count
      if (this.tenantId !== currentTenantId) {
        this.tenantId = currentTenantId;
        // Load count from KV for this specific tenant
        this.count = await this.env.USAGE_KV.get<number>(`count:${currentTenantId}`, { type: 'json' }) || 0;
        
        // Store the new tenant ID
        await this.state.storage.put('tenantId', this.tenantId);
      }

      this.count++;

      // Persist the count to both DO storage and KV
      await Promise.all([
        this.state.storage.put('count', this.count),
        this.env.USAGE_KV.put(`count:${currentTenantId}`, JSON.stringify(this.count))
      ]);

      if (this.count > this.env.USAGE_LIMIT) {
        console.log(`LIMIT BREACHED for ${currentTenantId}. Adding to Firewall list.`);
        
        // Fire-and-forget the API call to block the hostname
        this.state.waitUntil(
          updateFirewallList(this.env, new URL(request.url).hostname, 'add')
        );
        
        return new Response('Usage limit exceeded.', { 
          status: 429,
          headers: {
            'Content-Type': 'text/plain',
            'Retry-After': '3600' // Suggest retry after 1 hour
          }
        });
      }

      // Serve the content if under limit
      return await serveAssetFromR2({
        req: {
          url: request.url,
          method: request.method,
          headers: request.headers,
          // Add other request properties that serveAssetFromR2 might need
        },
        env: this.env,
        // Add other context properties that your serveAssetFromR2 function expects
      } as any);

    } catch (error) {
      console.error('Error in RateLimiter:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}