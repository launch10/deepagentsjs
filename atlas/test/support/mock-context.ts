import { env } from 'cloudflare:test';
import { Context } from 'hono';
import { Env, CloudEnvironment } from '~/types';

export function createMockContext(options: { cloudEnv?: CloudEnvironment } = {}): Context<{ Bindings: Env }> {
  const { cloudEnv = 'production' } = options;
  
  const executionContext = {
    waitUntil: (promise: Promise<unknown>) => {},
    passThroughOnException: () => {},
  };

  const request = new Request('http://localhost/');
  
  const variables: Record<string, unknown> = {
    cloudEnv,
  };

  return {
    req: {
      url: 'http://localhost/',
      header: (name: string) => name === 'X-Environment' ? cloudEnv : undefined,
      raw: request,
    },
    env: env as unknown as Env,
    executionCtx: executionContext,
    get: (key: string) => variables[key],
    set: (key: string, value: unknown) => { variables[key] = value; },
    var: variables,
  } as unknown as Context<{ Bindings: Env }>;
}
