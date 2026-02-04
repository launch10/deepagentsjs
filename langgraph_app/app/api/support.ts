/**
 * Support API
 *
 * Stream and load history for support chat conversations.
 */
import { graphParams } from "@core";
import { supportGraph } from "@graphs";
import { SupportBridge } from "@annotation";

const compiledGraph = supportGraph.compile({
  ...graphParams,
  name: "support",
});

export const SupportAPI = SupportBridge.bind(compiledGraph);

// Re-export bridge for nodes that need toStructuredMessage
export { SupportBridge } from "@annotation";
