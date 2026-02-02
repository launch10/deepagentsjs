/**
 * Database utilities for E2E tests.
 * Mirrors the pattern from langgraph_app/app/services/core/railsApi/snapshotter.ts
 */

import { e2eConfig } from "../config";

const BASE_URL = e2eConfig.railsBaseUrl;

export interface DatabaseOperationResult {
  status: string;
  message: string;
}

/**
 * Service for interacting with the Rails Test Database API.
 * Used in beforeEach hooks to restore database to known state.
 *
 * @example
 * test.beforeEach(async ({ page }) => {
 *   await DatabaseSnapshotter.restoreSnapshot("basic_account");
 *   await loginUser(page);
 * });
 */
export const DatabaseSnapshotter = {
  /**
   * Restores the database from a snapshot
   * @param name - Name of the snapshot to restore (without .sql extension)
   * @param truncateFirst - Whether to truncate the database before restoring
   */
  async restoreSnapshot(
    name: string,
    truncateFirst: boolean = true
  ): Promise<DatabaseOperationResult> {
    const response = await fetch(`${BASE_URL}/test/database/restore_snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshot: { name, truncate_first: truncateFirst },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to restore snapshot '${name}': ${response.status} - ${error}`);
    }

    return response.json();
  },

  /**
   * Truncates all tables in the database
   */
  async truncate(): Promise<DatabaseOperationResult> {
    const response = await fetch(`${BASE_URL}/test/database/truncate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to truncate database: ${response.status} - ${error}`);
    }

    return response.json();
  },

  /**
   * Lists all available database snapshots
   */
  async listSnapshots(): Promise<string[]> {
    const response = await fetch(`${BASE_URL}/test/database/snapshots`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list snapshots: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.snapshots;
  },

  /**
   * Gets the first project from the database.
   * Useful for getting the project UUID after restoring a snapshot.
   */
  async getFirstProject(): Promise<{ id: number; uuid: string; name: string }> {
    const response = await fetch(`${BASE_URL}/test/database/first_project`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get first project: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.project;
  },

  /**
   * Gets the first website from the database.
   * Useful for tracking tests that need a website ID.
   */
  async getFirstWebsite(): Promise<{ id: number; name: string; project_id: number }> {
    const response = await fetch(`${BASE_URL}/test/database/first_website`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get first website: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.website;
  },

  /**
   * Sets stripe_price_id on a credit pack.
   * Required for testing Stripe checkout flow.
   *
   * @param creditPackId - The credit pack ID
   * @param stripePriceId - The Stripe price ID to set
   */
  async setCreditPackStripePrice(
    creditPackId: number,
    stripePriceId: string
  ): Promise<{
    id: number;
    name: string;
    stripe_price_id: string;
  }> {
    const response = await fetch(`${BASE_URL}/test/database/set_credit_pack_stripe_price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credit_pack: {
          id: creditPackId,
          stripe_price_id: stripePriceId,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to set stripe price: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.credit_pack;
  },

  /**
   * Sets credits for a user's account.
   * Useful for testing credit exhaustion scenarios.
   *
   * @param email - The user's email address
   * @param planMillicredits - Plan credits in millicredits (1000 = 1 credit)
   * @param packMillicredits - Pack credits in millicredits (1000 = 1 credit)
   */
  async setCredits(
    email: string,
    planMillicredits: number,
    packMillicredits: number = 0
  ): Promise<{
    id: number;
    plan_millicredits: number;
    pack_millicredits: number;
    total_millicredits: number;
  }> {
    const response = await fetch(`${BASE_URL}/test/database/set_credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credits: {
          email,
          plan_millicredits: planMillicredits,
          pack_millicredits: packMillicredits,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to set credits: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.account;
  },

  /**
   * Creates platform subdomains to fill up the account's subdomain limit.
   * Useful for testing "out of credits" scenarios in domain picker.
   *
   * @param email - The user's email address
   */
  async fillSubdomainLimit(email: string): Promise<{
    subdomains_created: number;
    limit: number;
    used: number;
  }> {
    const response = await fetch(`${BASE_URL}/test/database/fill_subdomain_limit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subdomains: { email },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fill subdomain limit: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log("[DatabaseSnapshotter] fillSubdomainLimit response:", data);
    return data;
  },

  /**
   * Assigns a platform subdomain to a website for testing pre-population behavior.
   * Creates both a Domain and WebsiteUrl record.
   *
   * @param websiteId - The website ID to assign the subdomain to
   * @param subdomain - Optional subdomain name (defaults to random)
   * @param path - Optional path (defaults to "/")
   */
  async assignPlatformSubdomain(
    websiteId: number,
    subdomain?: string,
    path?: string
  ): Promise<{
    domain: {
      id: number;
      domain: string;
      subdomain: string;
      is_platform_subdomain: boolean;
    };
    website_url: {
      id: number;
      domain_id: number;
      website_id: number;
      path: string;
    };
  }> {
    const response = await fetch(`${BASE_URL}/test/database/assign_platform_subdomain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subdomain: {
          website_id: websiteId,
          subdomain,
          path,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to assign platform subdomain: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data;
  },

  /**
   * Assigns a custom domain to a website for testing auto-switch behavior.
   * Creates both a Domain and WebsiteUrl record.
   *
   * @param email - The user's email address
   * @param websiteId - The website ID to assign the domain to
   * @param domainName - Optional custom domain name (defaults to random .example.com)
   * @param path - Optional path (defaults to "/")
   */
  async assignCustomDomain(
    email: string,
    websiteId: number,
    domainName?: string,
    path?: string
  ): Promise<{
    domain: {
      id: number;
      domain: string;
      is_platform_subdomain: boolean;
      dns_verification_status: string;
    };
    website_url: {
      id: number;
      domain_id: number;
      website_id: number;
      path: string;
    };
  }> {
    const response = await fetch(`${BASE_URL}/test/database/assign_custom_domain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: {
          email,
          website_id: websiteId,
          domain_name: domainName,
          path,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to assign custom domain: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data;
  },
};
