/**
 * Website API
 *
 * Stream and load history for website builder conversations.
 */
import { graphParams } from "@core";
import { websiteGraph } from "@graphs";
import { WebsiteBridge } from "@annotation";

const compiledGraph = websiteGraph.compile({
  ...graphParams,
  name: "website",
});

export const WebsiteAPI = WebsiteBridge.bind(compiledGraph);

// Re-export bridge
export { WebsiteBridge } from "@annotation";
