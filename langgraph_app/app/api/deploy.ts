/**
 * Deploy API
 *
 * Bound graph API with automatic usage tracking.
 *
 * @example
 * ```typescript
 * import { DeployAPI } from "@api";
 *
 * return DeployAPI.stream({
 *   threadId,
 *   state: { jwt: auth.jwt, deployId, websiteId }
 * });
 * ```
 */
import { graphParams } from "@core";
import { deployGraph } from "@graphs";
import { DeployBridge } from "@annotation";

const compiledDeployGraph = deployGraph.compile({
  ...graphParams,
  name: "deploy",
});

export const DeployAPI = DeployBridge.bind(compiledDeployGraph);
