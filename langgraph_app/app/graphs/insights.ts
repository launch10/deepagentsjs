import { StateGraph, START, END } from "@langchain/langgraph";
import { InsightsAnnotation, type InsightsGraphState } from "@annotation";
import { generateInsightsNode, fetchMetricsNode, saveInsightsNode } from "@nodes";
import { withCreditExhaustion } from "./shared";

/**
 * Insights Graph
 *
 * A graph that generates analytics insights from metrics data.
 * Includes freshness checking to avoid regenerating fresh insights.
 *
 * Credit exhaustion is detected via withCreditExhaustion wrapper,
 * which runs this graph as a subgraph, then calculates credit status.
 *
 * Flow:
 * ┌───────────────────────────────────────────┐
 * │ START                                     │
 * │   │                                       │
 * │   ▼                                       │
 * │ fetchMetrics (check freshness + fetch)    │
 * │   │                                       │
 * │   ├── [if fresh] ──────────────────────▶ END (return cached)
 * │   │                                       │
 * │   ▼ [if stale]                            │
 * │ generateInsights (LLM)                    │
 * │   │                                       │
 * │   ▼                                       │
 * │ saveInsights (to Rails API)               │
 * │   │                                       │
 * │   ▼                                       │
 * │ END                                       │
 * └───────────────────────────────────────────┘
 *
 * The graph can be invoked with metricsInput already set (for testing)
 * or it will fetch from Rails if not provided.
 */

/**
 * Routes after fetchMetrics based on freshness check
 */
function routeAfterFetchMetrics(state: InsightsGraphState): "generateInsights" | "__end__" {
  // If skipGeneration is true, we have fresh cached insights - go straight to END
  if (state.skipGeneration) {
    return "__end__";
  }
  // Otherwise, generate new insights
  return "generateInsights";
}

export const insightsGraph = withCreditExhaustion(
  new StateGraph(InsightsAnnotation)
    .addNode("fetchMetrics", fetchMetricsNode)
    .addNode("generateInsights", generateInsightsNode)
    .addNode("saveInsights", saveInsightsNode)
    .addEdge(START, "fetchMetrics")
    .addConditionalEdges("fetchMetrics", routeAfterFetchMetrics)
    .addEdge("generateInsights", "saveInsights")
    .addEdge("saveInsights", END),
  InsightsAnnotation
);
