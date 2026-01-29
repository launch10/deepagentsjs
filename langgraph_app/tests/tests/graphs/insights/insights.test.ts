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
      const healthyMetrics: Insights.MetricsInput = {
        period: "Last 30 Days",
        totals: {
          leads: 74,
          page_views: 3278,
          ctr: 4.8,
          cpl: 13.84,
          ctr_available: true,
          cpl_available: true,
          roas: 3.5,
          roas_available: true,
          total_spend_dollars: 1024,
        },
        projects: [
          {
            uuid: "premium-pet-portraits-uuid",
            name: "Premium Pet Portraits",
            total_leads: 45,
            total_page_views: 2000,
            ctr: 5.2,
            cpl: 11.5,
            days_since_last_lead: 1,
            roas: 4.2,
            spend_dollars: 518,
          },
          {
            uuid: "budget-travel-uuid",
            name: "Budget Travel Guides",
            total_leads: 20,
            total_page_views: 800,
            ctr: 4.1,
            cpl: 16.5,
            days_since_last_lead: 2,
            roas: 2.8,
            spend_dollars: 330,
          },
          {
            uuid: "fitness-coaching-uuid",
            name: "Fitness Coaching",
            total_leads: 9,
            total_page_views: 478,
            ctr: 4.0,
            cpl: 19.5,
            days_since_last_lead: 3,
            roas: 2.0,
            spend_dollars: 176,
          },
        ],
        trends: {
          leads_trend: { direction: "up", percent: 25 },
          page_views_trend: { direction: "up", percent: 18 },
          ctr_trend: { direction: "up", percent: 12 },
          cpl_trend: { direction: "down", percent: 15 },
        },
        flags: {
          has_stalled_project: false,
          has_high_performer: true,
          has_new_first_lead: false,
        },
      };

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

        expect(result.state.generationError).toBeUndefined();
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

        expect(result.state.generationError).toBeUndefined();
        expect(result.state.insights).toHaveLength(3);

        const positiveInsights = result.state.insights!.filter((i) => i.sentiment === "positive");
        expect(positiveInsights.length).toBeGreaterThanOrEqual(1);
      });

      it.only("includes actionable URLs for each insight", async () => {
        const result = await testGraph<InsightsGraphState>()
          .withGraph(insightsGraph)
          .withState({
            jwt: "test-jwt",
          })
          .execute();

        expect(result.state.generationError).toBeUndefined();

        for (const insight of result.state.insights!) {
          expect(insight.action.url).toMatch(/^\/projects\//);
          expect(insight.action.label).toBeTruthy();
        }
      });
    });

    describe("with analytics/stalled_project", () => {
      const stalledMetrics: Insights.MetricsInput = {
        period: "Last 30 Days",
        totals: {
          leads: 106,
          page_views: 2800,
          ctr: 3.8,
          cpl: 18.5,
          ctr_available: true,
          cpl_available: true,
          total_spend_dollars: 780,
        },
        projects: [
          {
            uuid: "budget-travel-stalled-uuid",
            name: "Budget Travel Guides",
            total_leads: 8,
            total_page_views: 700,
            ctr: 3.2,
            cpl: null,
            days_since_last_lead: 16,
            spend_dollars: 190,
          },
          {
            uuid: "premium-pet-portraits-uuid",
            name: "Premium Pet Portraits",
            total_leads: 55,
            total_page_views: 1300,
            ctr: 4.5,
            cpl: 16.5,
            days_since_last_lead: 1,
            spend_dollars: 350,
          },
          {
            uuid: "fitness-coaching-uuid",
            name: "Fitness Coaching",
            total_leads: 43,
            total_page_views: 800,
            ctr: 3.9,
            cpl: 19.0,
            days_since_last_lead: 2,
            spend_dollars: 240,
          },
        ],
        trends: {
          leads_trend: { direction: "flat", percent: 5 },
          page_views_trend: { direction: "up", percent: 8 },
          ctr_trend: { direction: "flat", percent: 2 },
          cpl_trend: { direction: "up", percent: 10 },
        },
        flags: {
          has_stalled_project: true,
          has_high_performer: true,
          has_new_first_lead: false,
        },
      };

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

        expect(result.state.generationError).toBeUndefined();
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
      const strugglingMetrics: Insights.MetricsInput = {
        period: "Last 30 Days",
        totals: {
          leads: 0,
          page_views: 180,
          ctr: 0.9,
          cpl: null,
          ctr_available: true,
          cpl_available: false,
          total_spend_dollars: 334,
        },
        projects: [
          {
            uuid: "my-first-startup-uuid",
            name: "My First Startup",
            total_leads: 0,
            total_page_views: 180,
            ctr: 0.9,
            cpl: null,
            days_since_last_lead: null,
            spend_dollars: 334,
          },
        ],
        trends: {
          leads_trend: { direction: "flat", percent: 0 },
          page_views_trend: { direction: "down", percent: 25 },
          ctr_trend: { direction: "down", percent: 20 },
          cpl_trend: null,
        },
        flags: {
          has_stalled_project: false,
          has_high_performer: false,
          has_new_first_lead: false,
        },
      };

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

        expect(result.state.generationError).toBeUndefined();
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

        expect(result.state.generationError).toBeUndefined();

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
      const newAccountMetrics: Insights.MetricsInput = {
        period: "Last 3 Days",
        totals: {
          leads: 28,
          page_views: 65,
          ctr: 3.5,
          cpl: 12.5,
          ctr_available: true,
          cpl_available: true,
          total_spend_dollars: 48,
        },
        projects: [
          {
            uuid: "new-business-uuid",
            name: "My New Business",
            total_leads: 28,
            total_page_views: 65,
            ctr: 3.5,
            cpl: 12.5,
            days_since_last_lead: 0,
            spend_dollars: 48,
          },
        ],
        trends: {
          leads_trend: { direction: "up", percent: 100 },
          page_views_trend: { direction: "up", percent: 50 },
          ctr_trend: null,
          cpl_trend: null,
        },
        flags: {
          has_stalled_project: false,
          has_high_performer: false,
          has_new_first_lead: true,
        },
      };

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

        expect(result.state.generationError).toBeUndefined();
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

        expect(result.state.generationError).toBeUndefined();
        expect(result.state.insights).toHaveLength(3);
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
      expect(result.state.generationError).toBeUndefined();
      expect(result.state.insights).toHaveLength(3);
      expect(result.state.skipGeneration).toBe(true);
      expect(result.state.insights).toEqual(cachedInsights);
    });
  });
});
