import { RailsAPIBase } from "../index";
import type { Simplify } from "type-fest";

// DNS verification status type
export type DnsVerificationStatus = "pending" | "verified" | "failed" | null;

// Types for domain context response
export interface DomainWithWebsite {
  id: number;
  domain: string;
  is_platform_subdomain: boolean;
  website_id: number | null;
  website_name: string | null;
  website_urls: Array<{
    id: number;
    path: string;
    website_id: number;
  }>;
  dns_verification_status: DnsVerificationStatus;
  created_at: string;
}

export interface PlatformSubdomainCredits {
  limit: number;
  used: number;
  remaining: number;
}

export interface BrainstormContext {
  id: number;
  idea: string | null;
  audience: string | null;
  solution: string | null;
  social_proof: string | null;
}

export type PlanTier = "starter" | "growth" | "pro";

export interface AssignedWebsiteUrl {
  id: number;
  path: string;
  domain_id: number;
  domain: string;
  is_platform_subdomain: boolean;
  dns_verification_status: DnsVerificationStatus;
  full_url: string;
}

export interface GetDomainContextResponse {
  existing_domains: DomainWithWebsite[];
  assigned_url: AssignedWebsiteUrl | null;
  platform_subdomain_credits: PlatformSubdomainCredits;
  brainstorm_context: BrainstormContext | null;
  plan_tier: PlanTier | null;
}

/**
 * Service for fetching domain context from Rails API for subdomain picker
 */
export class DomainContextAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  async get(websiteId: number): Promise<GetDomainContextResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/websites/{website_id}/domain_context" as any, {
      params: { path: { website_id: websiteId } },
    });

    if (response.error) {
      throw new Error(`Failed to get domain context: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to get domain context: No data returned");
    }

    return response.data as GetDomainContextResponse;
  }
}
