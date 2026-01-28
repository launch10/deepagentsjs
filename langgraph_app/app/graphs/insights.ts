import { StateGraph, START, END } from "@langchain/langgraph";
import { InsightsAnnotation } from "@annotation";
import { generateInsightsNode, fetchMetricsNode, saveInsightsNode } from "@nodes";

/**
 * Insights Graph
 *
 * A graph that generates analytics insights from metrics data.
 * 1. Fetches metrics from Rails (if not already provided)
 * 2. Generates exactly 3 actionable insights using an LLM
 * 3. Saves insights back to Rails
 *
 * Flow:
 * ┌───────────────────────────────────────────┐
 * │ START                                     │
 * │   │                                       │
 * │   ▼                                       │
 * │ fetchMetrics (from Rails API)             │
 * │   │                                       │
 * │   ▼                                       │
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
export const insightsGraph = new StateGraph(InsightsAnnotation)
  .addNode("fetchMetrics", fetchMetricsNode)
  .addNode("generateInsights", generateInsightsNode)
  .addNode("saveInsights", saveInsightsNode)
  .addEdge(START, "fetchMetrics")
  .addEdge("fetchMetrics", "generateInsights")
  .addEdge("generateInsights", "saveInsights")
  .addEdge("saveInsights", END);
