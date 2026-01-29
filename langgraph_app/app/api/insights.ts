/**
 * Insights API
 *
 * Generate analytics insights from metrics data.
 */
import { graphParams } from "@core";
import { insightsGraph } from "@graphs";
import { InsightsBridge } from "@annotation";

const compiledGraph = insightsGraph.compile({
  ...graphParams,
  name: "insights",
});

export const InsightsAPI = InsightsBridge.bind(compiledGraph);

// Re-export bridge for consistency with other APIs
export { InsightsBridge } from "@annotation";
