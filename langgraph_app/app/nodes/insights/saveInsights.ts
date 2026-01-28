import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { type InsightsGraphState } from "@annotation";
import { DashboardInsightsAPIService } from "@services";

/**
 * Node that saves generated insights back to Rails.
 * This node should be called after generateInsights to persist the results.
 */
export const saveInsightsNode = NodeMiddleware.use(
  {},
  async (
    state: InsightsGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<InsightsGraphState>> => {
    // If there was an error or no insights, don't try to save
    if (state.generationError || !state.insights || state.insights.length === 0) {
      return {};
    }

    const jwt = config?.configurable?.jwt as string | undefined;
    if (!jwt) {
      return {
        generationError: "No JWT token provided for saving insights",
      };
    }

    try {
      const apiService = new DashboardInsightsAPIService({ jwt });

      const result = await apiService.save({
        insights: state.insights,
        metrics_summary: state.metricsInput,
      });

      return {
        dashboardInsightId: result.id ?? undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error saving insights";
      console.error("Error saving insights:", errorMessage);

      // Don't overwrite insights on save failure - they're still valid
      // Just log the error
      return {};
    }
  }
);
