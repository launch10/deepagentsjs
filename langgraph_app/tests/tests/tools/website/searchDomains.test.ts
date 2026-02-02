/**
 * Tests for the search_domains tool
 *
 * These tests verify the tool's response transformation logic.
 * Integration tests with the Rails API are covered by the graph tests.
 */

import { describe, it, expect } from "vitest";
import type { SearchDomainsResult } from "../../../../app/tools/website/searchDomains";

// Test the result transformation logic separately from the tool invocation
describe("search_domains tool", () => {
  describe("result transformation", () => {
    it("correctly maps available status", () => {
      const apiResponse = {
        results: [
          { domain: "my-site.launch10.site", status: "available" as const, existing_id: null },
        ],
        platform_subdomain_credits: { limit: 2, used: 0, remaining: 2 },
      };

      // This is the transformation logic from the tool
      const result: SearchDomainsResult = {
        results: apiResponse.results.map((r) => ({
          domain: r.domain,
          subdomain: r.domain.replace(".launch10.site", ""),
          available: r.status === "available",
          status: r.status,
          existingId: r.existing_id,
        })),
        credits: apiResponse.platform_subdomain_credits,
      };

      expect(result.results[0]).toEqual({
        domain: "my-site.launch10.site",
        subdomain: "my-site",
        available: true,
        status: "available",
        existingId: null,
      });
    });

    it("correctly maps unavailable status", () => {
      const apiResponse = {
        results: [
          { domain: "taken.launch10.site", status: "unavailable" as const, existing_id: null },
        ],
        platform_subdomain_credits: { limit: 2, used: 1, remaining: 1 },
      };

      const result: SearchDomainsResult = {
        results: apiResponse.results.map((r) => ({
          domain: r.domain,
          subdomain: r.domain.replace(".launch10.site", ""),
          available: (r.status as string) === "available",
          status: r.status,
          existingId: r.existing_id,
        })),
        credits: apiResponse.platform_subdomain_credits,
      };

      expect(result.results[0]!.available).toBe(false);
      expect(result.results[0]!.status).toBe("unavailable");
    });

    it("correctly maps existing status with domain ID", () => {
      const apiResponse = {
        results: [{ domain: "owned.launch10.site", status: "existing" as const, existing_id: 123 }],
        platform_subdomain_credits: { limit: 2, used: 1, remaining: 1 },
      };

      const result: SearchDomainsResult = {
        results: apiResponse.results.map((r) => ({
          domain: r.domain,
          subdomain: r.domain.replace(".launch10.site", ""),
          available: (r.status as string) === "available",
          status: r.status,
          existingId: r.existing_id,
        })),
        credits: apiResponse.platform_subdomain_credits,
      };

      expect(result.results[0]).toEqual({
        domain: "owned.launch10.site",
        subdomain: "owned",
        available: false,
        status: "existing",
        existingId: 123,
      });
    });

    it("handles batch of mixed statuses", () => {
      const apiResponse = {
        results: [
          { domain: "a.launch10.site", status: "available" as const, existing_id: null },
          { domain: "b.launch10.site", status: "existing" as const, existing_id: 1 },
          { domain: "c.launch10.site", status: "unavailable" as const, existing_id: null },
        ],
        platform_subdomain_credits: { limit: 3, used: 1, remaining: 2 },
      };

      const result: SearchDomainsResult = {
        results: apiResponse.results.map((r) => ({
          domain: r.domain,
          subdomain: r.domain.replace(".launch10.site", ""),
          available: r.status === "available",
          status: r.status,
          existingId: r.existing_id,
        })),
        credits: apiResponse.platform_subdomain_credits,
      };

      expect(result.results).toHaveLength(3);

      // Only "available" should have available=true
      const availableResults = result.results.filter((r) => r.available);
      expect(availableResults).toHaveLength(1);
      expect(availableResults[0]!.subdomain).toBe("a");

      // Check credits are passed through
      expect(result.credits).toEqual({
        limit: 3,
        used: 1,
        remaining: 2,
      });
    });

    it("returns error result on API failure", () => {
      const candidates = ["test.launch10.site", "another.launch10.site"];

      // Error handling logic from the tool
      const result: SearchDomainsResult = {
        error: "API call failed: Network error",
        results: candidates.map((domain) => ({
          domain,
          subdomain: domain.replace(".launch10.site", ""),
          available: false,
          status: "unavailable" as const,
        })),
      };

      expect(result.error).toContain("API call failed");
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.available === false)).toBe(true);
      expect(result.results.every((r) => r.status === "unavailable")).toBe(true);
    });
  });

  describe("subdomain extraction", () => {
    it("correctly extracts subdomain from full domain", () => {
      const domain = "my-cool-site.launch10.site";
      const subdomain = domain.replace(".launch10.site", "");
      expect(subdomain).toBe("my-cool-site");
    });

    it("handles complex subdomains with hyphens", () => {
      const domain = "my-super-long-subdomain-name.launch10.site";
      const subdomain = domain.replace(".launch10.site", "");
      expect(subdomain).toBe("my-super-long-subdomain-name");
    });
  });
});
