/**
 * Ads API
 *
 * Stream and load history for ad campaign conversations.
 */
import { graphParams } from "@core";
import { adsGraph } from "@graphs";
import { AdsBridge } from "@annotation";

const compiledGraph = adsGraph.compile({
  ...graphParams,
  name: "ads",
});

export const AdsAPI = AdsBridge.bind(compiledGraph);

// Re-export bridge for nodes that need toStructuredMessage
export { AdsBridge } from "@annotation";
