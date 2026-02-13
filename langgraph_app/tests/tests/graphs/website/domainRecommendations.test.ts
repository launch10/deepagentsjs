/**
 * Domain Recommendations Graph Tests
 *
 * Tests the domainRecommendationsNode as part of the website graph flow.
 * Uses CACHE_MODE=true to ensure websiteBuilder returns cached data quickly,
 * allowing us to focus on testing domain recommendations.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock cache mode to skip the expensive websiteBuilder LLM calls
vi.mock("../../../../app/nodes/website/cacheMode", () => ({
  isCacheModeEnabled: () => true,
  CACHE_MODE: true,
}));
import { testGraph } from "@support";
import { DatabaseSnapshotter } from "@services";
import { db, domains as domainsTable, websites, chats, brainstorms, eq, and } from "@db";
import { type ThreadIDType } from "@types";
import { websiteGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import type { WebsiteGraphState } from "@annotation";

const websiteGraph = uncompiledGraph.compile({
  ...graphParams,
  name: "website",
});

// domainRecommendationsNode is currently disabled (returns {} immediately).
// Skip tests until the feature is re-enabled.
describe.skip("Domain Recommendations (Graph Tests)", () => {
  let websiteId: number;
  let threadId: ThreadIDType;
  let accountId: number;
  let projectId: number;

  beforeEach(async () => {
    // website_step snapshot includes:
    // - brainstorm with idea, audience, solution, social_proof
    // - theme assigned to website
    // - domain test data for recommendations
    await DatabaseSnapshotter.restoreSnapshot("website_step");

    const [websiteRow] = await db.select().from(websites).limit(1);

    if (!websiteRow || !websiteRow.name) {
      throw new Error("No website found in snapshot");
    }

    websiteId = websiteRow.id;
    accountId = websiteRow.accountId ?? 1;
    projectId = websiteRow.projectId ?? 1;

    // Get the chat's threadId
    const [existingChat] = await db
      .select()
      .from(chats)
      .where(and(eq(chats.contextableId, websiteId), eq(chats.contextableType, "Website")))
      .limit(1);

    if (!existingChat?.threadId) {
      throw new Error("No chat with threadId found in snapshot for website");
    }

    threadId = existingChat.threadId as ThreadIDType;

    // Verify brainstorm exists
    const [brainstorm] = await db
      .select()
      .from(brainstorms)
      .where(eq(brainstorms.websiteId, websiteId))
      .limit(1);

    if (!brainstorm) {
      throw new Error("No brainstorm found for website");
    }
  }, 60000);

  describe("Domain Recommendations Generation", () => {
    it("generates domain recommendations when running the website graph", async () => {
      // Create a domain owned by another user so "timesync" is unavailable
      const now = new Date().toISOString();
      await db.insert(domainsTable).values({
        domain: "timesync.launch10.site",
        accountId: 2,
        isPlatformSubdomain: true,
        createdAt: now,
        updatedAt: now,
      });

      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          threadId,
          accountId,
          projectId,
        })
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.state.status).toBe("completed");

      // Domain recommendations should be populated
      const recommendations = result.state.domainRecommendations;
      expect(recommendations).toBeDefined();
      expect(recommendations?.recommendations).toBeDefined();
      expect(recommendations?.recommendations.length).toBeGreaterThan(0);

      // Should have a state indicating the recommendation type
      expect(recommendations?.state).toMatch(
        /no_existing_sites|existing_recommended|new_recommended|out_of_credits_no_match/
      );

      // Top recommendation should be set
      expect(recommendations?.topRecommendation).toBeDefined();
      const existingRecommendations = recommendations?.recommendations.filter(
        (rec) => rec.source === "existing"
      );
      const newRecommendations = recommendations?.recommendations.filter(
        (rec) => rec.source === "suggestion"
      );

      expect(existingRecommendations?.length).toBeGreaterThan(0);
      expect(newRecommendations?.length).toBeGreaterThan(0);

      // Core invariants for all recommendations
      recommendations?.recommendations.forEach((rec) => {
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(100);
        expect(rec.domain).toMatch(/\.launch10\.site$/);
        expect(rec.path).toBeDefined();
      });

      // Generated recommendations must only include available domains
      // (timesync.launch10.site was inserted as owned by another user)
      newRecommendations?.forEach((rec) => {
        expect(rec.availability).toBe("available");
        expect(rec.subdomain).not.toBe("timesync"); // We blocked this one
      });

      // Existing recommendations should reference the user's own domains
      existingRecommendations?.forEach((rec) => {
        expect(rec.availability).toBe("existing");
        expect(rec.existingDomainId).toBeDefined();
      });
    });

    it("includes proper domain format with .launch10.site suffix", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          threadId,
          accountId,
          projectId,
        })
        .execute();

      expect(result.error).toBeUndefined();

      const recommendations = result.state.domainRecommendations;
      expect(recommendations).toBeDefined();

      // Each recommendation should have proper domain format
      for (const rec of recommendations?.recommendations || []) {
        expect(rec.domain).toMatch(/\.launch10\.site$/);
        expect(rec.subdomain).toBeDefined();
        expect(rec.path).toBeDefined();
        expect(rec.fullUrl).toBeDefined();
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(100);
        expect(rec.source).toMatch(/existing|suggestion/);
      }
    });

    it("top recommendation has all required fields", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          threadId,
          accountId,
          projectId,
        })
        .execute();

      expect(result.error).toBeUndefined();

      const topRec = result.state.domainRecommendations?.topRecommendation;
      expect(topRec).toBeDefined();

      if (topRec) {
        expect(topRec.domain).toMatch(/\.launch10\.site$/);
        expect(topRec.subdomain).toBeDefined();
        expect(topRec.path).toBeDefined();
        expect(topRec.source).toMatch(/existing|suggestion/);
      }
    });
  });

  describe("Idempotency", () => {
    it("does not regenerate recommendations if already present in state", async () => {
      const existingRecommendations = {
        state: "no_existing_sites" as const,
        recommendations: [
          {
            domain: "test-domain.launch10.site",
            subdomain: "test-domain",
            path: "/",
            fullUrl: "test-domain.launch10.site",
            score: 90,
            reasoning: "Pre-existing recommendation",
            source: "suggestion" as const,
            availability: "available" as const,
          },
        ],
        topRecommendation: {
          domain: "test-domain.launch10.site",
          subdomain: "test-domain",
          path: "/",
          fullUrl: "test-domain.launch10.site",
          score: 90,
          reasoning: "Pre-existing recommendation",
          source: "suggestion" as const,
          availability: "available" as const,
        },
      };

      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          threadId,
          accountId,
          projectId,
          domainRecommendations: existingRecommendations,
        })
        .execute();

      expect(result.error).toBeUndefined();

      // Should keep the existing recommendations, not overwrite them
      expect(result.state.domainRecommendations).toEqual(existingRecommendations);
    });
  });

  describe("Cache Mode Integration", () => {
    it("websiteBuilder returns cached files in cache mode", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          threadId,
          accountId,
          projectId,
        })
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.state.status).toBe("completed");

      // In cache mode, files should be populated from cache
      expect(result.state.files).toBeDefined();
      expect(Object.keys(result.state.files || {}).length).toBeGreaterThan(0);
    });
  });
});
