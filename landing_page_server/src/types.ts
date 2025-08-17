import { DurableObjectNamespace, KVNamespace, R2Bucket } from '@cloudflare/workers-types';

export type Plan = {
    name: string;
    usageLimit: number;
}

// Used to resolve R2 paths
export interface TenantInfo {
  userId: string;
  orgId: string;
  siteName: string;
}

export const usageThresholdPercent = 0.90;

export const plans: Map<string, Plan> = new Map([
    ['starter', { name: 'Starter', usageLimit: 1_000_000 }],
    ['pro', { name: 'Pro', usageLimit: 5_000_000 }],
    ['enterprise', { name: 'Enterprise', usageLimit: 20_000_000 }],
]);

export interface Env {
  USAGE_LIMIT: KVNamespace;
  USER_PAGES: R2Bucket;
  RATE_LIMITER: DurableObjectNamespace;

  // Environment variables
  LOG_LEVEL?: string;
  NODE_ENV?: string;
  USAGE_MONITORING_THRESHOLD_PERCENT?: string;
  
  // Secrets
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_LIST_ID?: string;
}
