import { Miniflare } from 'miniflare';
import type { MockContext } from '../../sdk/types.js';
import { loadWranglerConfig, getKVNamespaceId, getR2BucketName } from './wrangler-config.js';

let mf: Miniflare | null = null;

export async function createMockContext(): Promise<MockContext> {
  if (!mf) {
    // Load configuration from wrangler TOML
    const config = loadWranglerConfig();
    
    // Get KV namespace configuration
    const kvNamespaces: Record<string, string> = {};
    if (config.kv_namespaces) {
      for (const ns of config.kv_namespaces) {
        kvNamespaces[ns.binding] = ns.id;
      }
    }
    
    // Get R2 bucket configuration
    const r2Buckets: Record<string, string> = {};
    if (config.r2_buckets) {
      for (const bucket of config.r2_buckets) {
        r2Buckets[bucket.binding] = bucket.bucket_name;
      }
    }
    
    mf = new Miniflare({
      modules: true,
      script: `export default { fetch: () => new Response('CLI KV Access') }`,
      kvNamespaces,
      r2Buckets,
      kvPersist: './.wrangler/state/v3/kv',
      r2Persist: './.wrangler/state/v3/r2',
    });
  }
  
  const kv = await mf.getKVNamespace('DEPLOYS_KV');
  
  return {
    env: {
      DEPLOYS_KV: kv,
      FIREWALL_DO: undefined,
    },
    executionCtx: {
      waitUntil: (promise: Promise<any>) => {
        promise.catch(console.error);
      },
      passThroughOnException: () => {}
    }
  };
}

export async function cleanupMockContext() {
  if (mf) {
    await mf.dispose();
    mf = null;
  }
}