import { describe, it, expect, beforeEach } from "vitest";
import { Insights } from "@types";
import { DatabaseSnapshotter } from "@services";
import { testGraph } from "@tests/support";
import { insightsGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import type { InsightsGraphState } from "@annotation";

const insightsGraph = uncompiledGraph.compile({ ...graphParams, name: "insights" });

/**
 * Sample metrics for each test scenario.
 * These match the data that would be fetched from Rails for each snapshot.
 * Using pre-defined metrics in unit tests skips the Rails API call.
 */
const HEALTHY_ACCOUNT_METRICS: Insights.Metrics = {
  period: "Last 30 Days",
  totals: {
    leads: 47,
    page_views: 3420,
    ctr: 4.5,
    cpl: 18.03,
    ctr_available: true,
    cpl_available: true,
    roas: 3.5,
    total_spend_dollars: 847.5,
  },
  projects: [
    {
      uuid: "premium-pet-portraits-uuid",
      name: "Premium Pet Portraits",
      total_leads: 32,
      total_page_views: 2400,
      ctr: 5.1,
      cpl: 16.34,
      roas: 4.2,
      spend_dollars: 523,
      days_since_last_lead: 1,
    },
    {
      uuid: "budget-travel-uuid",
      name: "Budget Travel Guides",
      total_leads: 10,
      total_page_views: 600,
      ctr: 3.8,
      cpl: 22.5,
      roas: 2.1,
      spend_dollars: 225,
      days_since_last_lead: 2,
    },
    {
      uuid: "fitness-coaching-uuid",
      name: "Fitness Coaching",
      total_leads: 5,
      total_page_views: 420,
      ctr: 3.2,
      cpl: 19.9,
      roas: 2.5,
      spend_dollars: 99.5,
      days_since_last_lead: 3,
    },
  ],
  trends: {
    leads_trend: { direction: "up", percent: 23 },
    page_views_trend: { direction: "up", percent: 15 },
    ctr_trend: { direction: "up", percent: 10 },
    cpl_trend: { direction: "down", percent: 12 },
  },
  flags: {
    has_high_performer: true,
  },
};

const STALLED_PROJECT_METRICS: Insights.Metrics = {
  period: "Last 30 Days",
  totals: {
    leads: 25,
    page_views: 2100,
    ctr: 3.2,
    cpl: 28.5,
    ctr_available: true,
    cpl_available: true,
  },
  projects: [
    {
      uuid: "premium-pet-portraits-uuid",
      name: "Premium Pet Portraits",
      total_leads: 18,
      total_page_views: 1400,
      ctr: 4.2,
      cpl: 22.0,
      days_since_last_lead: 2,
    },
    {
      uuid: "budget-travel-uuid",
      name: "Budget Travel Guides",
      total_leads: 0,
      total_page_views: 350,
      ctr: 1.8,
      cpl: null,
      days_since_last_lead: 14,
    },
    {
      uuid: "fitness-coaching-uuid",
      name: "Fitness Coaching",
      total_leads: 7,
      total_page_views: 350,
      ctr: 2.9,
      cpl: 35.0,
      days_since_last_lead: 3,
    },
  ],
  trends: {
    leads_trend: { direction: "down", percent: 15 },
    page_views_trend: { direction: "flat", percent: 2 },
  },
  flags: {
    has_stalled_project: true,
  },
};

const STRUGGLING_ACCOUNT_METRICS: Insights.Metrics = {
  period: "Last 30 Days",
  totals: {
    leads: 2,
    page_views: 890,
    ctr: 1.1,
    cpl: 145.0,
    ctr_available: true,
    cpl_available: true,
    total_spend_dollars: 290,
  },
  projects: [
    {
      uuid: "my-first-startup-uuid",
      name: "My First Startup",
      total_leads: 2,
      total_page_views: 890,
      ctr: 1.1,
      cpl: 145.0,
      spend_dollars: 290,
      days_since_last_lead: 8,
    },
  ],
  trends: {
    leads_trend: { direction: "down", percent: 50 },
    page_views_trend: { direction: "down", percent: 25 },
    ctr_trend: { direction: "down", percent: 30 },
    cpl_trend: { direction: "up", percent: 80 },
  },
  flags: {
    has_stalled_project: true,
  },
};

const NEW_ACCOUNT_METRICS: Insights.Metrics = {
  period: "Last 7 Days",
  totals: {
    leads: 1,
    page_views: 45,
    ctr: 2.5,
    cpl: 15.0,
    ctr_available: true,
    cpl_available: true,
    total_spend_dollars: 15,
  },
  projects: [
    {
      uuid: "my-new-business-uuid",
      name: "My New Business",
      total_leads: 1,
      total_page_views: 45,
      ctr: 2.5,
      cpl: 15.0,
      spend_dollars: 15,
      days_since_last_lead: 0,
    },
  ],
  trends: {
    leads_trend: { direction: "up", percent: 100 },
    page_views_trend: { direction: "up", percent: 100 },
  },
  flags: {
    has_new_first_lead: true,
  },
};

/**
 * INSIGHTS GRAPH INTEGRATION TESTS
 *
 * Uses testGraph pattern with Polly handled automatically via NodeMiddleware.
 * Uses pre-defined metrics data for unit tests (skips Rails API calls).
 * E2E tests validate the full pipeline including Rails integration.
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
            metrics: HEALTHY_ACCOUNT_METRICS,
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
            metrics: HEALTHY_ACCOUNT_METRICS,
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
            metrics: HEALTHY_ACCOUNT_METRICS,
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
            metrics: STALLED_PROJECT_METRICS,
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
            metrics: STRUGGLING_ACCOUNT_METRICS,
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
            metrics: STRUGGLING_ACCOUNT_METRICS,
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
            metrics: NEW_ACCOUNT_METRICS,
          })
          .execute();

        expect(result.state.error).toBeUndefined();
        expect(result.state.insights).toHaveLength(3);

        const positiveInsights = result.state.insights!.filter((i) => i.sentiment === "positive");
        expect(positiveInsights.length).toBeGreaterThanOrEqual(1);
      });

      it("handles missing optional fields gracefully", async () => {
        const minimalInput: Insights.Metrics = {
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

        const parseResult = Insights.metricsSchema.safeParse(minimalInput);
        expect(parseResult.success).toBe(true);

        const result = await testGraph<InsightsGraphState>()
          .withGraph(insightsGraph)
          .withState({
            jwt: "test-jwt",
            metrics: minimalInput,
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
