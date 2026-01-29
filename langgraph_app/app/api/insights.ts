/**
 * Insights API
 *
 * Generate analytics insights from metrics data.
 */
import { graphParams } from "@core";
import { insightsGraph } from "@graphs";
import { InsightsBridge } from "@annotation";
import { v7 as uuidv7 } from "uuid";

const compiledGraph = insightsGraph.compile({
  ...graphParams,
  name: "insights",
});

// Bridge-bound API for streaming (future use) and usage tracking
export const InsightsStreamAPI = InsightsBridge.bind(compiledGraph);

// Re-export bridge for consistency with other APIs
export { InsightsBridge } from "@annotation";

/**
 * Simple invoke API for one-shot insight generation.
 * Uses the bridge pattern but provides a direct invoke method.
 */
export const InsightsAPI = {
  /**
   * Generate insights for the authenticated user's account
   *
   * @param jwt - JWT token for authentication
   * @param threadId - Optional thread ID for checkpointing
   * @returns Generated insights
   */
  async generate({ jwt, threadId }: { jwt: string; threadId?: string }) {
    const thread_id = threadId ?? uuidv7();

    const result = await compiledGraph.invoke(
      {},
      {
        configurable: {
          thread_id,
          jwt,
        },
      }
    );

    return {
      insights: result.insights || [],
      metrics: result.metrics,
      error: result.error?.message,
    };
  },
};
