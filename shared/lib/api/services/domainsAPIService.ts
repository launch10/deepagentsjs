import { RailsAPIBase, type paths } from "../index";
import type { Options } from "../railsApiBase";
import type { Simplify } from "type-fest";

// ============================================================================
// Type Definitions
// ============================================================================

export type GetDomainsResponse = NonNullable<
  paths["/api/v1/domains"]["get"]["responses"][200]["content"]["application/json"]
>;

export type CreateDomainRequest = NonNullable<
  paths["/api/v1/domains"]["post"]["requestBody"]
>["content"]["application/json"];

export type CreateDomainResponse = NonNullable<
  paths["/api/v1/domains"]["post"]["responses"][201]["content"]["application/json"]
>;

export type GetDomainResponse = NonNullable<
  paths["/api/v1/domains/{id}"]["get"]["responses"][200]["content"]["application/json"]
>;

export type UpdateDomainRequest = NonNullable<
  paths["/api/v1/domains/{id}"]["patch"]["requestBody"]
>["content"]["application/json"];

export type UpdateDomainResponse = NonNullable<
  paths["/api/v1/domains/{id}"]["patch"]["responses"][200]["content"]["application/json"]
>;

// ============================================================================
// Service Class
// ============================================================================

/**
 * Service for interacting with the Rails Domains API
 */
export class DomainsAPIService extends RailsAPIBase {
  private jwt: string;

  constructor(options: Simplify<Options> & { jwt: string }) {
    super(options);
    this.jwt = options.jwt;
  }

  /**
   * Get all domains for the current account
   */
  async list(websiteId?: number): Promise<GetDomainsResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/domains", {
      params: {
        query: websiteId ? { website_id: websiteId } : undefined,
      },
    });

    if (response.error) {
      throw new Error(`Failed to list domains: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to list domains: No data returned");
    }

    return response.data satisfies GetDomainsResponse;
  }

  /**
   * Get a single domain by ID
   */
  async get(domainId: number): Promise<GetDomainResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/domains/{id}", {
      params: {
        path: { id: domainId },
      },
    });

    if (response.error) {
      throw new Error(`Failed to get domain: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to get domain: No data returned");
    }

    return response.data satisfies GetDomainResponse;
  }

  /**
   * Create a new domain and assign it to a website
   */
  async create(domain: CreateDomainRequest["domain"]): Promise<CreateDomainResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/domains", {
      body: { domain },
    });

    if (response.error) {
      throw new Error(`Failed to create domain: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to create domain: No data returned");
    }

    return response.data satisfies CreateDomainResponse;
  }

  /**
   * Update a domain (e.g., reassign to a different website)
   */
  async update(
    domainId: number,
    domain: UpdateDomainRequest["domain"]
  ): Promise<UpdateDomainResponse> {
    const client = await this.getClient();
    const response = await client.PATCH("/api/v1/domains/{id}", {
      params: {
        path: { id: domainId },
        header: {
          Authorization: `Bearer ${this.jwt}`,
        },
      },
      body: { domain },
    });

    if (response.error) {
      throw new Error(`Failed to update domain: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to update domain: No data returned");
    }

    return response.data satisfies UpdateDomainResponse;
  }
}
