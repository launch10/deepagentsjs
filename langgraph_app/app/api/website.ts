/**
 * Website API
 *
 * Bound graph API with automatic usage tracking.
 * Pass `context: { chatId }` in stream options for billing.
 *
 * @example
 * ```typescript
 * import { WebsiteAPI } from "@api";
 *
 * return WebsiteAPI.stream({
 *   messages,
 *   threadId,
 *   context: { chatId },
 *   state: { jwt: auth.jwt }
 * });
 * ```
 */
import { graphParams } from "@core";
import { websiteGraph } from "@graphs";
import { WebsiteBridge } from "@bridges";

const compiledWebsiteGraph = websiteGraph.compile({
  ...graphParams,
  name: "website",
});

export const WebsiteAPI = WebsiteBridge.bind(compiledWebsiteGraph);
