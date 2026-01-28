import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { type InsightsGraphState } from "@annotation";
import { DashboardInsightsAPIService } from "@services";

/**
 * Node that fetches metrics from Rails for insight generation.
 * This node should be called at the start of the graph before generateInsights.
 */
export const fetchMetricsNode = NodeMiddleware.use(
  {},
  async (
    state: InsightsGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<InsightsGraphState>> => {
    // If metricsInput is already provided (for testing), skip fetching
    if (state.metricsInput) {
      return {};
    }

    const jwt = config?.configurable?.jwt as string | undefined;
    if (!jwt) {
      return {
        generationError: "No JWT token provided for fetching metrics",
      };
    }

    try {
      const apiService = new DashboardInsightsAPIService({ jwt });

      const metricsInput = await apiService.getMetricsSummary();

      return {
        metricsInput,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error fetching metrics";
      console.error("Error fetching metrics:", errorMessage);

      return {
        generationError: errorMessage,
      };
    }
  }
);
