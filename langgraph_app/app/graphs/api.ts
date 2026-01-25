/**
 * Graph APIs
 *
 * This module exports bound graph APIs ready for use in routes.
 * Usage tracking is built into the bridges via createAppBridge.
 *
 * Routes should pass `chatId` via the `context` option:
 * @example
 * ```typescript
 * import { BrainstormAPI } from "@graphs";
 *
 * app.post("/stream", async (c) => {
 *   const { messages, threadId } = await c.req.json();
 *   const chatId = await getChatId(threadId);
 *
 *   return BrainstormAPI.stream({
 *     messages,
 *     threadId,
 *     context: { chatId },  // Required for billing
 *     state: { jwt: auth.jwt }
 *   });
 * });
 * ```
 */

import { graphParams } from "@core";
import { brainstormGraph } from "./brainstorm";
import { websiteGraph } from "./website";
import { adsGraph } from "./ads";
import { deployGraph } from "./deploy";
import { BrainstormBridge, WebsiteBridge, AdsBridge } from "@annotation";

// =============================================================================
// Brainstorm Graph
// =============================================================================

const compiledBrainstormGraph = brainstormGraph.compile({
  ...graphParams,
  name: "brainstorm",
});

/**
 * Brainstorm API with automatic usage tracking.
 * Pass `context: { chatId }` in stream options for billing.
 */
export const BrainstormAPI = BrainstormBridge.bind(compiledBrainstormGraph);

// =============================================================================
// Website Graph
// =============================================================================

const compiledWebsiteGraph = websiteGraph.compile({
  ...graphParams,
  name: "website",
});

/**
 * Website API with automatic usage tracking.
 * Pass `context: { chatId }` in stream options for billing.
 */
export const WebsiteAPI = WebsiteBridge.bind(compiledWebsiteGraph);

// =============================================================================
// Ads Graph
// =============================================================================

const compiledAdsGraph = adsGraph.compile({
  ...graphParams,
  name: "ads",
});

/**
 * Ads API with automatic usage tracking.
 * Pass `context: { chatId }` in stream options for billing.
 */
export const AdsAPI = AdsBridge.bind(compiledAdsGraph as any);

// =============================================================================
// Deploy Graph
// Note: Deploy graph doesn't use the Bridge pattern - use streamWithUsageTracking
// =============================================================================

/**
 * Compiled deploy graph for direct invocation.
 * Use usageTrackingMiddleware wrapper in routes for billing.
 */
export const compiledDeployGraph = deployGraph.compile({
  ...graphParams,
  name: "deploy",
});
