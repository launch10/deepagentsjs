import { env } from 'cloudflare:test';
import { Context } from 'hono';
import { Env } from '~/types';

export function createMockContext(): Context<{ Bindings: Env }> {
  const executionContext = {
    waitUntil: (promise: Promise<unknown>) => {},
    passThroughOnException: () => {},
  };

  const request = new Request('http://localhost/');

  return {
    req: {
      url: 'http://localhost/',
      header: () => undefined,
      raw: request,
    },
    env: env as unknown as Env,
    executionCtx: executionContext,
    get: () => undefined,
    set: () => {},
    var: {},
  } as unknown as Context<{ Bindings: Env }>;
}
