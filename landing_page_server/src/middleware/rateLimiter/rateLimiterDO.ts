import { Env } from '../../types';
import { updateFirewallList } from '../../utils/cloudflareApi';
import { serveAssetFromR2 } from '../../r2Assets';
import { DurableObject, DurableObjectState } from '@cloudflare/workers-types';
import { scopedLogger, getSiteName } from './utils';
export class RateLimiterDO implements DurableObject {
  state: DurableObjectState;
  env: Env;
  count: number = 0;
  siteName: string | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // Initialize count from storage
    this.state.blockConcurrencyWhile(async () => {
      this.count = await this.state.storage.get<number>('count') || 0;
      this.siteName = await this.state.storage.get<string>('siteName') || null;
    });
  }

  async fetch(request: Request, context: ExecutionContext): Promise<Response> {
    try {
      // const siteName = getSiteName(request);
      const siteName = getSiteName(request.url); 
      scopedLogger.debug(`in the DO bb fetching for ${siteName}`);

      // If this is a new tenant for this DO instance, reset count
      if (this.siteName !== siteName) {
        this.siteName = siteName;
        // Load count from KV for this specific tenant
        this.count = await this.env.USAGE_LIMIT.get<number>(`count:${siteName}`, { type: 'json' }) || 0;
        
        // Store the new tenant ID
        await this.state.storage.put('siteName', this.siteName);
      }

      this.count++;

      // Persist the count to both DO storage and KV
      await Promise.all([
        this.state.storage.put('count', this.count),
        this.env.USAGE_LIMIT.put(`count:${siteName}`, JSON.stringify(this.count))
      ]);

      if (this.count > this.env.USAGE_LIMIT) {
        console.log(`LIMIT BREACHED for ${siteName}. Adding to Firewall list.`);
        
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