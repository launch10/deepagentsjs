import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { type InsightsGraphState } from "@annotation";
import { DashboardInsightsAPIService } from "@services";

/**
 * Node that checks freshness and fetches metrics from Rails for insight generation.
 *
 * Flow:
 * 1. If skipGeneration already true with insights (testing cache), skip everything
 * 2. If metricsInput already provided (testing), skip to generation
 * 3. Check Rails for existing insights and freshness status
 * 4. If fresh: return cached insights, set skipGeneration=true
 * 5. If stale/missing: fetch metrics for generation
 */
export const fetchMetricsNode = NodeMiddleware.use(
  {},
  async (
    state: InsightsGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<InsightsGraphState>> => {
    // If skipGeneration is already set with insights (simulating cache hit), skip everything
    if (state.skipGeneration && state.insights && state.insights.length > 0) {
      return {};
    }

    // If metricsInput is already provided (for testing), skip freshness check
    if (state.metricsInput) {
      return {};
    }

    const jwt = state.jwt;
    if (!jwt) {
      return {
        error: { message: "No JWT token provided for fetching metrics", node: "fetchMetrics" },
      };
    }

    try {
      const apiService = new DashboardInsightsAPIService({ jwt });

      // Step 1: Check if we have fresh cached insights
      const existing = await apiService.get();

      if (existing.fresh && existing.insights && existing.insights.length > 0) {
        // Insights are fresh - return cached and skip generation
        return {
          insights: existing.insights,
          skipGeneration: true,
          dashboardInsightId: existing.id ?? undefined,
        };
      }

      // Step 2: Insights are stale or missing - fetch metrics for generation
      const metricsInput = await apiService.getMetricsSummary();

      return {
        metricsInput,
        skipGeneration: false,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error fetching metrics";
      console.error("Error fetching metrics:", errorMessage);

      return {
        error: { message: errorMessage, node: "fetchMetrics" },
      };
    }
  }
);
