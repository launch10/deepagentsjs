import { Context } from 'hono';
import type { Env } from '../types.js';

export type SDKContext = Context<{ Bindings: Env }> | MockContext;

export interface MockContext {
  env: {
    DEPLOYS_KV: KVNamespace;
    FIREWALL_DO?: DurableObjectNamespace;
  };
  executionCtx: {
    waitUntil: (promise: Promise<any>) => void;
    passThroughOnException: () => void;
  };
}

export interface SDKConfig {
  context: SDKContext;
}

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ListOptions {
  limit?: number;
  prefix?: string;
}