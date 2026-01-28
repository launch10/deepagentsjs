import { StateGraph, START, END } from "@langchain/langgraph";
import { InsightsAnnotation } from "@annotation";
import { generateInsightsNode } from "@nodes";

/**
 * Insights Graph
 *
 * A simple graph that generates analytics insights from metrics data.
 * Input: metricsInput (from Rails InsightsMetricsService)
 * Output: insights array (exactly 3 actionable insights)
 *
 * Flow:
 * ┌───────────────────────────────────────────┐
 * │ START                                     │
 * │   │                                       │
 * │   ▼                                       │
 * │ generateInsights                          │
 * │   │                                       │
 * │   ▼                                       │
 * │ END                                       │
 * └───────────────────────────────────────────┘
 *
 * This is intentionally simple - insights don't require multi-step
 * processing or conversation history. It's a single LLM call with
 * structured output.
 */
export const insightsGraph = new StateGraph(InsightsAnnotation)
  .addNode("generateInsights", generateInsightsNode)
  .addEdge(START, "generateInsights")
  .addEdge("generateInsights", END);
