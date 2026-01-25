/**
 * Deploy Graph
 *
 * Note: Deploy graph doesn't use the Bridge pattern.
 * Use streamWithUsageTracking wrapper in routes for billing.
 *
 * @example
 * ```typescript
 * import { compiledDeployGraph } from "@api";
 * import { streamWithUsageTracking } from "@core";
 *
 * return streamWithUsageTracking(
 *   { threadId, graphName: "deploy" },
 *   async () => {
 *     const stream = await compiledDeployGraph.stream(state, config);
 *     return new Response(stream);
 *   }
 * );
 * ```
 */
import { graphParams } from "@core";
import { deployGraph } from "@graphs";

export const compiledDeployGraph = deployGraph.compile({
  ...graphParams,
  name: "deploy",
});
