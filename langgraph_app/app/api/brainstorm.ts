/**
 * Brainstorm API
 *
 * Bound graph API with automatic usage tracking.
 * Pass `context: { chatId }` in stream options for billing.
 *
 * @example
 * ```typescript
 * import { BrainstormAPI } from "@api";
 *
 * return BrainstormAPI.stream({
 *   messages,
 *   threadId,
 *   context: { chatId },
 *   state: { jwt: auth.jwt }
 * });
 * ```
 */
import { graphParams } from "@core";
import { brainstormGraph } from "@graphs";
import { BrainstormBridge } from "@bridges";

const compiledBrainstormGraph = brainstormGraph.compile({
  ...graphParams,
  name: "brainstorm",
});

export const BrainstormAPI = BrainstormBridge.bind(compiledBrainstormGraph);
