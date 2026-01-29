import { describe, it, expect, beforeEach } from "vitest";
import { Insights } from "@types";
import { DatabaseSnapshotter } from "@services";
import { testGraph } from "@tests/support";
import { insightsGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import type { InsightsGraphState } from "@annotation";

const insightsGraph = uncompiledGraph.compile({ ...graphParams, name: "insights" });

/**
 * INSIGHTS GRAPH INTEGRATION TESTS
 *
 * Uses testGraph pattern with Polly handled automatically via NodeMiddleware.
 * Uses analytics snapshots for realistic test data.
 */

describe("Insights Generation", () => {
  describe("Insights Schema Validation", () => {
    it("validates a correct insight object", () => {
      const validInsight: Insights.Insight = {
        title: "Lead Generation Stalled",
        description:
          "Budget Travel Guides hasn't generated leads in 14 days despite spending $187.",
        sentiment: "negative",
        project_uuid: "project-uuid-2",
        action: {
          label: "Review Keywords",
          url: "/projects/project-uuid-2/campaigns/content",
        },
      };

      const result = Insights.insightSchema.safeParse(validInsight);
      expect(result.success).toBe(true);
    });

    it("validates the insights array must have exactly 3 insights", () => {
      const twoInsights = [
        {
          title: "Insight 1",
          description: "Description 1",
          sentiment: "positive" as const,
          project_uuid: null,
          action: { label: "Action", url: "/action" },
        },
        {
          title: "Insight 2",
          description: "Description 2",
          sentiment: "negative" as const,
          project_uuid: null,
          action: { label: "Action", url: "/action" },
        },
      ];

      const result = Insights.insightsArraySchema.safeParse(twoInsights);
      expect(result.success).toBe(false);
    });

    it("validates ACTION_REGISTRY produces correct URLs", () => {
      const uuid = "test-uuid-123";
      expect(Insights.ACTION_REGISTRY.review_ad_copy.urlBuilder(uuid)).toBe(
        "/projects/test-uuid-123/campaigns/content"
      );
      expect(Insights.ACTION_REGISTRY.review_landing_page.urlBuilder(uuid)).toBe(
        "/projects/test-uuid-123/website"
      );
      expect(Insights.ACTION_REGISTRY.review_keywords.urlBuilder(uuid)).toBe(
        "/projects/test-uuid-123/campaigns/keywords"
      );
      expect(Insights.ACTION_REGISTRY.adjust_budget.urlBuilder(uuid)).toBe(
        "/projects/test-uuid-123/campaigns/settings"
      );
      expect(Insights.ACTION_REGISTRY.pause_campaign.urlBuilder(uuid)).toBe(
        "/projects/test-uuid-123/campaigns/settings"
      );
      expect(Insights.ACTION_REGISTRY.view_leads.urlBuilder(uuid)).toBe(
        "/projects/test-uuid-123/leads"
      );
      expect(Insights.ACTION_REGISTRY.review_selling_points.urlBuilder(uuid)).toBe(
        "/projects/test-uuid-123/campaigns/highlights"
      );
      expect(Insights.ACTION_REGISTRY.refine_messaging.urlBuilder(uuid)).toBe(
        "/projects/test-uuid-123/brainstorm"
      );
    });

    it("resolves insight intents to full insights", () => {
      const projects = [
        { uuid: "uuid-1", name: "Project One" },
        { uuid: "uuid-2", name: "Project Two" },
      ];

      const intent: Insights.InsightIntent = {
        title: "Test Insight",
        description: "Test description",
        sentiment: "positive",
        project_index: 1,
        action_type: "review_ad_copy",
      };

      const resolved = Insights.resolveInsightIntent(intent, projects);

      expect(resolved.project_uuid).toBe("uuid-1");
      expect(resolved.action.label).toBe("Review Ad Copy");
      expect(resolved.action.url).toBe("/projects/uuid-1/campaigns/content");
    });

    it("throws for invalid project_index", () => {
      const projects = [{ uuid: "uuid-1", name: "Project One" }];

      const intent: Insights.InsightIntent = {
        title: "Test",
        description: "Test",
        sentiment: "neutral",
        project_index: 5, // Invalid - only 1 project
        action_type: "view_leads",
      };

      expect(() => Insights.resolveInsightIntent(intent, projects)).toThrow(
        "Invalid project index: 5"
      );
    });
  });

  describe.sequential("Insights Graph Integration", () => {
    describe("with analytics/healthy_account", () => {
      beforeEach(async () => {
        await DatabaseSnapshotter.restoreSnapshot("analytics/healthy_account");
      }, 30000);

      it("generates exactly 3 insights from healthy metrics", async () => {
        const result = await testGraph<InsightsGraphState>()
          .withGraph(insightsGraph)
          .withState({
            jwt: "test-jwt",
          })
          .execute();

        expect(result.state.error).toBeUndefined();
        expect(result.state.insights).toHaveLength(3);

        for (const insight of result.state.insights!) {
          expect(insight.title).toBeDefined();
          expect(insight.title.length).toBeLessThanOrEqual(50);
          expect(insight.description).toBeDefined();
          expect(["positive", "negative", "neutral"]).toContain(insight.sentiment);
          expect(insight.action).toBeDefined();
          expect(insight.action.url).toMatch(/^\//);
        }
      });

      it("includes at least one positive insight when data warrants it", async () => {
        const result = await testGraph<InsightsGraphState>()
          .withGraph(insightsGraph)
          .withState({
            jwt: "test-jwt",
          })
          .execute();

        expect(result.state.error).toBeUndefined();
        expect(result.state.insights).toHaveLength(3);

        const positiveInsights = result.state.insights!.filter((i) => i.sentiment === "positive");
        expect(positiveInsights.length).toBeGreaterThanOrEqual(1);
      });

      it("includes actionable URLs for each insight", async () => {
        const result = await testGraph<InsightsGraphState>()
          .withGraph(insightsGraph)
          .withState({
            jwt: "test-jwt",
          })
          .execute();

        expect(result.state.error).toBeUndefined();

        for (const insight of result.state.insights!) {
          expect(insight.action.url).toMatch(/^\/projects\//);
          expect(insight.action.label).toBeTruthy();
        }
      });
    });

    describe("with analytics/stalled_project", () => {
      beforeEach(async () => {
        await DatabaseSnapshotter.restoreSnapshot("analytics/stalled_project");
      }, 30000);

      it("flags stalled projects with negative sentiment", async () => {
        const result = await testGraph<InsightsGraphState>()
          .withGraph(insightsGraph)
          .withState({
            jwt: "test-jwt",
          })
          .execute();

        expect(result.state.error).toBeUndefined();
        expect(result.state.insights).toHaveLength(3);

        const stalledInsight = result.state.insights!.find(
          (i) =>
            i.description.toLowerCase().includes("budget travel") ||
            i.description.toLowerCase().includes("stalled") ||
            i.description.includes("16") ||
            i.description.includes("14")
        );

        expect(stalledInsight).toBeDefined();
        if (stalledInsight) {
          expect(["negative", "neutral"]).toContain(stalledInsight.sentiment);
        }
      });
    });

    describe("with analytics/struggling_account", () => {
      beforeEach(async () => {
        await DatabaseSnapshotter.restoreSnapshot("analytics/struggling_account");
      }, 30000);

      it("handles struggling accounts gracefully", async () => {
        const result = await testGraph<InsightsGraphState>()
          .withGraph(insightsGraph)
          .withState({
            jwt: "test-jwt",
          })
          .execute();

        expect(result.state.error).toBeUndefined();
        expect(result.state.insights).toHaveLength(3);

        for (const insight of result.state.insights!) {
          expect(insight.title).toBeDefined();
          expect(insight.description).toBeDefined();
          expect(insight.action).toBeDefined();
          expect(insight.action.url).toMatch(/^\//);
        }
      });

      it("provides constructive advice despite bad data", async () => {
        const result = await testGraph<InsightsGraphState>()
          .withGraph(insightsGraph)
          .withState({
            jwt: "test-jwt",
          })
          .execute();

        expect(result.state.error).toBeUndefined();

        const insightTexts = result.state
          .insights!.map((i) => `${i.title} ${i.description} ${i.action.label}`)
          .join(" ")
          .toLowerCase();

        const mentionsImprovement =
          insightTexts.includes("ad") ||
          insightTexts.includes("target") ||
          insightTexts.includes("landing") ||
          insightTexts.includes("page") ||
          insightTexts.includes("copy") ||
          insightTexts.includes("budget") ||
          insightTexts.includes("review");

        expect(mentionsImprovement).toBe(true);
      });
    });

    describe("with analytics/new_account", () => {
      beforeEach(async () => {
        await DatabaseSnapshotter.restoreSnapshot("analytics/new_account");
      }, 30000);

      it("generates insights from minimal data (new account)", async () => {
        const result = await testGraph<InsightsGraphState>()
          .withGraph(insightsGraph)
          .withState({
            jwt: "test-jwt",
          })
          .execute();

        expect(result.state.error).toBeUndefined();
        expect(result.state.insights).toHaveLength(3);

        const positiveInsights = result.state.insights!.filter((i) => i.sentiment === "positive");
        expect(positiveInsights.length).toBeGreaterThanOrEqual(1);
      });

      it("handles missing optional fields gracefully", async () => {
        const minimalInput: Insights.MetricsInput = {
          period: "Last 3 Days",
          totals: {
            leads: 3,
            page_views: 45,
            ctr: null,
            cpl: null,
            ctr_available: false,
            cpl_available: false,
          },
          projects: [],
          trends: {
            leads_trend: { direction: "up", percent: 50 },
            page_views_trend: { direction: "flat", percent: 0 },
          },
        };

        const parseResult = Insights.metricsInputSchema.safeParse(minimalInput);
        expect(parseResult.success).toBe(true);

        const result = await testGraph<InsightsGraphState>()
          .withGraph(insightsGraph)
          .withState({
            jwt: "test-jwt",
            metricsInput: minimalInput,
          })
          .execute();

        // With no projects, we get "get started" insights instead of LLM-generated ones
        expect(result.state.error).toBeUndefined();
        expect(result.state.insights).toHaveLength(3);
        expect(result.state.insights![0]!.title).toBe("Deploy Your First Project");
      });
    });
  });

  describe("Freshness Caching", () => {
    it("skips generation when insights are already cached (skipGeneration=true)", async () => {
      // Simulates what happens when fetchMetrics finds fresh insights in Rails
      const cachedInsights: Insights.Insight[] = [
        {
          title: "Cached Insight 1",
          description: "This is a cached insight from Rails",
          sentiment: "positive",
          project_uuid: "test-uuid",
          action: { label: "View", url: "/projects/test-uuid" },
        },
        {
          title: "Cached Insight 2",
          description: "Another cached insight",
          sentiment: "neutral",
          project_uuid: null,
          action: { label: "Review", url: "/projects/test-uuid/website" },
        },
        {
          title: "Cached Insight 3",
          description: "Third cached insight",
          sentiment: "negative",
          project_uuid: null,
          action: { label: "Fix", url: "/projects/test-uuid/campaigns/content" },
        },
      ];

      const result = await testGraph<InsightsGraphState>()
        .withGraph(insightsGraph)
        .withState({
          jwt: "test-jwt",
          insights: cachedInsights,
          skipGeneration: true,
        })
        .execute();

      // Should return immediately with cached insights, no LLM call
      expect(result.state.error).toBeUndefined();
      expect(result.state.insights).toHaveLength(3);
      expect(result.state.skipGeneration).toBe(true);
      expect(result.state.insights).toEqual(cachedInsights);
    });
  });
});
