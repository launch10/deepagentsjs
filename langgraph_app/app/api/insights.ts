/**
 * Insights API
 *
 * Generate analytics insights from metrics data.
 */
import { graphParams } from "@core";
import { insightsGraph } from "@graphs";
import { Insights } from "@types";

const compiledGraph = insightsGraph.compile({
  ...graphParams,
  name: "insights",
});

export const InsightsAPI = {
  /**
   * Generate insights from metrics data
   *
   * @param metricsInput - Metrics summary from Rails InsightsMetricsService
   * @returns Generated insights
   */
  async generate(metricsInput: Insights.MetricsInput) {
    const result = await compiledGraph.invoke({
      metricsInput,
    });

    return {
      insights: result.insights || [],
      error: result.generationError,
    };
  },
};
