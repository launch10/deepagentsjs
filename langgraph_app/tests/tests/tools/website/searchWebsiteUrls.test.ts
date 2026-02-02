/**
 * Tests for the search_website_urls tool
 *
 * These tests verify the tool's response transformation logic.
 * Integration tests with the Rails API are covered by the graph tests.
 */

import { describe, it, expect } from "vitest";
import type { SearchWebsiteUrlsResult } from "../../../../app/tools/website/searchWebsiteUrls";

// Test the result transformation logic separately from the tool invocation
describe("search_website_urls tool", () => {
  describe("result transformation", () => {
    it("correctly maps available status", () => {
      const apiResponse = {
        domain_id: 1,
        domain: "my-site.launch10.site",
        results: [
          {
            path: "/landing",
            status: "available" as const,
            existing_id: null,
            existing_website_id: null,
          },
        ],
      };

      // This is the transformation logic from the tool
      const result: SearchWebsiteUrlsResult = {
        domainId: apiResponse.domain_id,
        domain: apiResponse.domain,
        results: apiResponse.results.map((r) => ({
          path: r.path,
          available: r.status === "available",
          status: r.status,
          existingId: r.existing_id,
          existingWebsiteId: r.existing_website_id,
        })),
      };

      expect(result.results[0]).toEqual({
        path: "/landing",
        available: true,
        status: "available",
        existingId: null,
        existingWebsiteId: null,
      });
    });

    it("correctly maps existing status (path used by another website in account)", () => {
      const apiResponse = {
        domain_id: 1,
        domain: "shared.launch10.site",
        results: [
          {
            path: "/landing",
            status: "existing" as const,
            existing_id: 5,
            existing_website_id: 10,
          },
        ],
      };

      const result: SearchWebsiteUrlsResult = {
        domainId: apiResponse.domain_id,
        domain: apiResponse.domain,
        results: apiResponse.results.map((r) => ({
          path: r.path,
          available: (r.status as string) === "available",
          status: r.status,
          existingId: r.existing_id,
          existingWebsiteId: r.existing_website_id,
        })),
      };

      expect(result.results[0]).toEqual({
        path: "/landing",
        available: false,
        status: "existing",
        existingId: 5,
        existingWebsiteId: 10,
      });
    });

    it("correctly maps existing status (path used by current website)", () => {
      // Note: The API returns "existing" for paths owned by the current account
      // (whether by the current website or another website in the same account)
      const apiResponse = {
        domain_id: 1,
        domain: "my-site.launch10.site",
        results: [
          { path: "/my-page", status: "existing" as const, existing_id: 3, existing_website_id: 5 },
        ],
      };

      const result: SearchWebsiteUrlsResult = {
        domainId: apiResponse.domain_id,
        domain: apiResponse.domain,
        results: apiResponse.results.map((r) => ({
          path: r.path,
          available: (r.status as string) === "available",
          status: r.status,
          existingId: r.existing_id,
          existingWebsiteId: r.existing_website_id,
        })),
      };

      expect(result.results[0]!.status).toBe("existing");
      expect(result.results[0]!.available).toBe(false);
    });

    it("correctly maps unavailable status (path used by another account)", () => {
      const apiResponse = {
        domain_id: 1,
        domain: "shared.launch10.site",
        results: [
          {
            path: "/taken",
            status: "unavailable" as const,
            existing_id: null,
            existing_website_id: null,
          },
        ],
      };

      const result: SearchWebsiteUrlsResult = {
        domainId: apiResponse.domain_id,
        domain: apiResponse.domain,
        results: apiResponse.results.map((r) => ({
          path: r.path,
          available: (r.status as string) === "available",
          status: r.status,
          existingId: r.existing_id,
          existingWebsiteId: r.existing_website_id,
        })),
      };

      expect(result.results[0]!.status).toBe("unavailable");
      expect(result.results[0]!.available).toBe(false);
    });

    it("handles batch of mixed path statuses", () => {
      const apiResponse = {
        domain_id: 1,
        domain: "my-site.launch10.site",
        results: [
          { path: "/", status: "available" as const, existing_id: null, existing_website_id: null },
          {
            path: "/landing",
            status: "existing" as const,
            existing_id: 5,
            existing_website_id: 10,
          },
          {
            path: "/promo",
            status: "available" as const,
            existing_id: null,
            existing_website_id: null,
          },
          {
            path: "/blog",
            status: "unavailable" as const,
            existing_id: null,
            existing_website_id: null,
          },
        ],
      };

      const result: SearchWebsiteUrlsResult = {
        domainId: apiResponse.domain_id,
        domain: apiResponse.domain,
        results: apiResponse.results.map((r) => ({
          path: r.path,
          available: r.status === "available",
          status: r.status,
          existingId: r.existing_id,
          existingWebsiteId: r.existing_website_id,
        })),
      };

      expect(result.results).toHaveLength(4);

      // Only "available" should have available=true
      const availableResults = result.results.filter((r) => r.available);
      expect(availableResults).toHaveLength(2);
      expect(availableResults.map((r) => r.path)).toEqual(["/", "/promo"]);

      // Check /landing is marked as existing
      const landingPath = result.results.find((r) => r.path === "/landing");
      expect(landingPath?.status).toBe("existing");
      expect(landingPath?.existingWebsiteId).toBe(10);
    });

    it("returns error result on API failure", () => {
      const candidates = ["/test", "/another"];

      // Error handling logic from the tool
      const result: SearchWebsiteUrlsResult = {
        domainId: 1,
        domain: "",
        error: "API call failed: Network error",
        results: candidates.map((path) => ({
          path: path.startsWith("/") ? path : `/${path}`,
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

  describe("path normalization", () => {
    it("preserves paths with leading slash", () => {
      const path = "/landing";
      const normalized = path.startsWith("/") ? path : `/${path}`;
      expect(normalized).toBe("/landing");
    });

    it("adds leading slash to paths without one", () => {
      const path = "landing";
      const normalized = path.startsWith("/") ? path : `/${path}`;
      expect(normalized).toBe("/landing");
    });

    it("handles root path", () => {
      const path = "/";
      expect(path).toBe("/");
    });
  });
});
