import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { Insights, type PrimaryKeyType } from "@types";
import { createAppBridge } from "@api/middleware";

/**
 * Insights Graph Annotation
 *
 * Defines the state shape for the insights generation graph.
 * Input: metrics summary from Rails
 * Output: array of 3 actionable insights
 */
export const InsightsAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  // Metrics summary from Rails InsightsMetricsService
  metrics: Annotation<Insights.Metrics | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),

  // Output: Generated insights
  insights: Annotation<Insights.Insight[]>({
    default: () => [],
    reducer: (current, next) => (next.length > 0 ? next : current),
  }),

  // Dashboard insight ID (for saving back to Rails)
  dashboardInsightId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),

  // Flag to skip generation when insights are fresh (< 24 hours old)
  skipGeneration: Annotation<boolean>({
    default: () => false,
    reducer: (current, next) => next,
  }),
});

export type InsightsGraphState = typeof InsightsAnnotation.State;

// Bridge for insights API - uses createAppBridge for automatic usage tracking
export const InsightsBridge = createAppBridge({
  endpoint: "/api/insights/generate",
  stateAnnotation: InsightsAnnotation as any,
  messageSchema: Insights.jsonSchema,
  jsonTarget: "state",
});
