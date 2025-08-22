import { DurableObjectNamespace, KVNamespace, R2Bucket } from '@cloudflare/workers-types';

export const usageThresholdPercent = 0.90;
export interface Env {
  DEPLOYS_KV: KVNamespace;
  DEPLOYS_R2: R2Bucket;
  DEPLOYS_R2_STAGING?: R2Bucket;
  DEPLOYS_R2_DEVELOPMENT?: R2Bucket;
  FIREWALL: DurableObjectNamespace;
  FIREWALL_DO?: DurableObjectNamespace;

  // Environment variables
  LOG_LEVEL?: string;
  NODE_ENV?: string;
  USAGE_MONITORING_THRESHOLD_PERCENT?: string;
  LOG_IGNORE_SCOPES?: string;
  LOG_FOCUS_SCOPES?: string;
  
  // Secrets
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  ALLOWED_IPS?: string;
  ATLAS_API_SECRET?: string;
}

export type Model = {
  id: string;
}
export interface PlanType extends Model {
  name: string;
  usageLimit: number;
}
export interface UserType extends Model {
  planId?: string;
}

export interface RequestType extends Model {
  userId: string;
  count: number;
}

export interface WebsiteType extends Model {
  userId: string;
}

export interface DomainType extends Model {
  websiteId: string;
  domain: string;
}

export type PlanName = 'starter' | 'pro' | 'enterprise';
export const plans: Map<string, PlanType> = new Map([
    ['starter' as PlanName, { id: '1', name: 'Starter', usageLimit: 1_000_000 }],
    ['pro' as PlanName, { id: '2', name: 'Pro', usageLimit: 5_000_000 }],
    ['enterprise' as PlanName, { id: '3', name: 'Enterprise', usageLimit: 20_000_000 }],
]);

// We will flow like this:
// User visits www.example.com
// We find domain www.example.com
// Domain points to website: 1
// We load r2/website/1/live/index.html
// We look for website.user
// We increment request count for website.user on request model.
// If request count exceeds plan limit, we block the request.
