import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { Insights, type PrimaryKeyType } from "@types";

/**
 * Insights Graph Annotation
 *
 * Defines the state shape for the insights generation graph.
 * Input: metrics summary from Rails
 * Output: array of 3 actionable insights
 */
export const InsightsAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  // Input: Metrics summary from Rails InsightsMetricsService
  metricsInput: Annotation<Insights.MetricsInput | undefined>({
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

  // Error during generation
  generationError: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),
});

export type InsightsGraphState = typeof InsightsAnnotation.State;
