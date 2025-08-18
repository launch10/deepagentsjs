import { Miniflare } from 'miniflare';
import type { MockContext } from '../../sdk/types.js';

let mf: Miniflare | null = null;

export async function createMockContext(): Promise<MockContext> {
  if (!mf) {
    mf = new Miniflare({
      modules: true,
      script: `export default { fetch: () => new Response('CLI KV Access') }`,
      kvNamespaces: ['DEPLOYS_KV'],
      kvPersist: './.wrangler/state/v3/kv',
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