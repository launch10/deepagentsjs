import { Miniflare } from 'miniflare';
import { Context } from 'hono';
import dotenv from 'dotenv';
import path from 'path';
import type { Env } from '../../types.js';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });

let mf: Miniflare | null = null;

export async function getMockContext(): Promise<Context<{ Bindings: Env }>> {
  if (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) {
    throw new Error('Production KV access not yet implemented. Use wrangler kv commands directly.');
  }
  
  if (!mf) {
    mf = new Miniflare({
      modules: true,
      script: `export default { fetch: () => new Response('CLI KV Access') }`,
      kvNamespaces: ['DEPLOYS_KV'],
      kvPersist: './.wrangler/state/v3/kv',
    });
  }
  
  const kv = await mf.getKVNamespace('DEPLOYS_KV');
  
  // Create a mock Hono context with the required structure
  const mockContext = {
    env: {
      DEPLOYS_KV: kv,
      FIREWALL_DO: {} as any, // Mock durable object namespace
    },
    executionCtx: {
      waitUntil: (promise: Promise<any>) => {
        // In CLI, we can just wait for the promise
        promise.catch(console.error);
      },
      passThroughOnException: () => {}
    },
    req: {} as any,
    res: {} as any,
    render: () => new Response(),
    header: () => {},
    status: () => {},
    set: () => {},
    get: () => undefined,
    var: {} as any,
    newResponse: () => new Response(),
    body: () => new Response(),
    text: () => new Response(),
    json: () => new Response(),
    html: () => new Response(),
    notFound: () => new Response(),
    redirect: () => new Response(),
  } as unknown as Context<{ Bindings: Env }>;
  
  return mockContext;
}

export async function cleanup() {
  if (mf) {
    await mf.dispose();
    mf = null;
  }
}