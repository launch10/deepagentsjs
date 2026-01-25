/**
 * Deploy API
 *
 * Stream and load history for deployment workflows.
 */
import { graphParams } from "@core";
import { deployGraph } from "@graphs";
import { DeployBridge } from "@annotation";

const compiledGraph = deployGraph.compile({
  ...graphParams,
  name: "deploy",
});

export const DeployAPI = DeployBridge.bind(compiledGraph);

// Re-export bridge
export { DeployBridge } from "@annotation";
