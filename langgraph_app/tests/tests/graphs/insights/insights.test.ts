import { describe, it, expect, beforeEach } from "vitest";
import { Insights } from "@types";
import type { InsightsGraphState } from "@annotation";

// Import will be available after implementation
// import { insightsGraph } from "@graphs";
// import { generateInsightsNode } from "@nodes";

describe("Insights Generation", () => {
  // Sample metrics input representing a typical account
  const sampleMetricsInput: Insights.MetricsInput = {
    period: "Last 30 Days",
    totals: {
      leads: 47,
      page_views: 3420,
      ctr: 4.2,
      cpl: 18.03,
      ctr_available: true,
      cpl_available: true,
      roas: 3.5,
      roas_available: true,
      total_spend_dollars: 847.5,
    },
    projects: [
      {
        uuid: "project-uuid-1",
        name: "Premium Pet Portraits",
        total_leads: 32,
        total_page_views: 2400,
        ctr: 5.1,
        cpl: 16.34,
        days_since_last_lead: 1,
        roas: 4.2,
        spend_dollars: 523.0,
      },
      {
        uuid: "project-uuid-2",
        name: "Budget Travel Guides",
        total_leads: 0,
        total_page_views: 500,
        ctr: 1.2,
        cpl: null,
        days_since_last_lead: 14, // Stalled!
        roas: null,
        spend_dollars: 187.0,
      },
      {
        uuid: "project-uuid-3",
        name: "Fitness Coaching",
        total_leads: 15,
        total_page_views: 520,
        ctr: 3.8,
        cpl: 22.5,
        days_since_last_lead: 3,
        roas: 2.1,
        spend_dollars: 137.5,
      },
    ],
    trends: {
      leads_trend: { direction: "up", percent: 23 },
      page_views_trend: { direction: "up", percent: 15 },
      ctr_trend: { direction: "up", percent: 10 },
      cpl_trend: { direction: "down", percent: 12 }, // Down is good for CPL
    },
    flags: {
      has_stalled_project: true,
      has_high_performer: true,
      has_new_first_lead: false,
    },
  };

  // Minimal metrics with no leads (struggling account)
  const strugglingMetricsInput: Insights.MetricsInput = {
    period: "Last 30 Days",
    totals: {
      leads: 0,
      page_views: 250,
      ctr: 0.8,
      cpl: null,
      ctr_available: true,
      cpl_available: false,
      total_spend_dollars: 320.0,
    },
    projects: [
      {
        uuid: "project-uuid-struggling",
        name: "My First Startup",
        total_leads: 0,
        total_page_views: 250,
        ctr: 0.8,
        cpl: null,
        days_since_last_lead: null,
        spend_dollars: 320.0,
      },
    ],
    trends: {
      leads_trend: { direction: "flat", percent: 0 },
      page_views_trend: { direction: "down", percent: 30 },
      ctr_trend: { direction: "down", percent: 25 },
      cpl_trend: null,
    },
  };

  describe("Insights Schema Validation", () => {
    it("validates a correct insight object", () => {
      const validInsight: Insights.Insight = {
        title: "Lead Generation Stalled",
        description:
          "Budget Travel Guides hasn't generated leads in 14 days despite spending $187. Consider reviewing your targeting or ad copy.",
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

    it("validates metricsInput schema", () => {
      const result = Insights.metricsInputSchema.safeParse(sampleMetricsInput);
      expect(result.success).toBe(true);
    });

    it("validates action URLs helper produces correct paths", () => {
      const uuid = "test-uuid-123";
      expect(Insights.ACTION_URLS.REVIEW_AD_COPY(uuid)).toBe(
        "/projects/test-uuid-123/campaigns/content"
      );
      expect(Insights.ACTION_URLS.REVIEW_LANDING_PAGE(uuid)).toBe(
        "/projects/test-uuid-123/website"
      );
      expect(Insights.ACTION_URLS.ADJUST_TARGETING(uuid)).toBe(
        "/projects/test-uuid-123/campaigns/targeting"
      );
      expect(Insights.ACTION_URLS.ADJUST_BUDGET(uuid)).toBe(
        "/projects/test-uuid-123/campaigns/budget"
      );
    });
  });

  describe("generateInsightsNode", () => {
    it.skip("generates exactly 3 insights", async () => {
      // TODO: Implement after node is created
      // const result = await generateInsightsNode({ metricsInput: sampleMetricsInput });
      // expect(result.insights).toHaveLength(3);
    });

    it.skip("ensures at least one positive insight when data warrants it", async () => {
      // TODO: Implement after node is created
      // Rule: Always find a positive when things are going well
      // const result = await generateInsightsNode({ metricsInput: sampleMetricsInput });
      // const positiveInsights = result.insights.filter(i => i.sentiment === "positive");
      // expect(positiveInsights.length).toBeGreaterThanOrEqual(1);
    });

    it.skip("flags stalled projects with negative sentiment", async () => {
      // TODO: Implement after node is created
      // A project with 0 leads and 14+ days_since_last_lead should be flagged
      // const result = await generateInsightsNode({ metricsInput: sampleMetricsInput });
      // const stalledInsight = result.insights.find(
      //   i => i.project_uuid === "project-uuid-2" && i.sentiment === "negative"
      // );
      // expect(stalledInsight).toBeDefined();
    });

    it.skip("includes actionable URLs for each insight", async () => {
      // TODO: Implement after node is created
      // const result = await generateInsightsNode({ metricsInput: sampleMetricsInput });
      // result.insights.forEach(insight => {
      //   expect(insight.action.url).toMatch(/^\/projects\//);
      //   expect(insight.action.label).toBeTruthy();
      // });
    });

    it.skip("handles struggling accounts gracefully (all negative metrics)", async () => {
      // TODO: Implement after node is created
      // Even with all bad data, we should still produce 3 insights with actionable advice
      // const result = await generateInsightsNode({ metricsInput: strugglingMetricsInput });
      // expect(result.insights).toHaveLength(3);
      // // Should still try to find something positive or at least constructive
    });
  });

  describe("Insights Graph Integration", () => {
    it.skip("processes metrics input and returns insights", async () => {
      // TODO: Implement after graph is created
      // Full graph integration test
    });

    it.skip("handles missing optional fields gracefully", async () => {
      // TODO: Implement after graph is created
      // Test with minimal required fields only
      const minimalInput: Insights.MetricsInput = {
        period: "Last 30 Days",
        totals: {
          leads: 5,
          page_views: 100,
          ctr: null,
          cpl: null,
          ctr_available: false,
          cpl_available: false,
        },
        projects: [],
        trends: {
          leads_trend: { direction: "up", percent: 10 },
          page_views_trend: { direction: "flat", percent: 0 },
        },
      };

      const result = Insights.metricsInputSchema.safeParse(minimalInput);
      expect(result.success).toBe(true);
    });
  });
});
