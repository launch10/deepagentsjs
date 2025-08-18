import { DurableObjectNamespace, KVNamespace, R2Bucket } from '@cloudflare/workers-types';

export const usageThresholdPercent = 0.90;
export interface Env {
  DEPLOYS_KV: KVNamespace;
  DEPLOYS_R2: R2Bucket;
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
  CLOUDFLARE_BLOCKED_DOMAINS_LIST_ID?: string;
  JWT_SECRET?: string;
}

export type Model = {
  id: string;
}
export interface PlanType extends Model {
  name: string;
  usageLimit: number;
}
export interface TenantType extends Model {
  orgId: string;
  planId: string;
}

export interface RequestType extends Model {
  tenantId: string;
  count: number;
}
export interface SiteType extends Model {
  url: string;
  tenantId: string;
  live: string;
  preview: string;
}
export interface DeployType extends Model {
  version: string;
  siteId: string;
}

export type FirewallStatus = 'inactive' | 'monitoring' | 'blocked';
export interface FirewallType extends Model {
  tenantId: string;
  status: FirewallStatus;
}

export type PlanName = 'starter' | 'pro' | 'enterprise';
export const plans: Map<string, PlanType> = new Map([
    ['starter' as PlanName, { id: '1', name: 'Starter', usageLimit: 1_000_000 }],
    ['pro' as PlanName, { id: '2', name: 'Pro', usageLimit: 5_000_000 }],
    ['enterprise' as PlanName, { id: '3', name: 'Enterprise', usageLimit: 20_000_000 }],
]);