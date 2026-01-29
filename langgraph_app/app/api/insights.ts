/**
 * Insights API
 *
 * Generate analytics insights from metrics data.
 */
import { graphParams } from "@core";
import { insightsGraph } from "@graphs";
import { Insights } from "@types";
import { v7 as uuidv7 } from "uuid";

const compiledGraph = insightsGraph.compile({
  ...graphParams,
  name: "insights",
});

export interface InsightsAPIOptions {
  /** JWT token for authentication - required for fetching metrics from Rails */
  jwt: string;
  /** Optional thread ID for checkpointing (generates one if not provided) */
  threadId?: string;
  /** Optional pre-fetched metrics (for testing - skips fetchMetrics node) */
  metricsInput?: Insights.MetricsInput;
}

export const InsightsAPI = {
  /**
   * Generate insights for the authenticated user's account
   *
   * The graph fetches metrics from Rails via the JWT, generates insights,
   * and optionally saves them back to Rails.
   *
   * @param options - Configuration options
   * @returns Generated insights
   */
  async generate(options: InsightsAPIOptions) {
    const { jwt, threadId, metricsInput } = options;
    const thread_id = threadId ?? uuidv7();

    const result = await compiledGraph.invoke(
      {
        // If metricsInput provided, skip fetchMetrics node
        ...(metricsInput ? { metricsInput } : {}),
      },
      {
        configurable: {
          thread_id,
          jwt,
        },
      }
    );

    return {
      insights: result.insights || [],
      metricsInput: result.metricsInput,
      error: result.generationError,
    };
  },
};
