/**
 * App Bridge Factory
 *
 * Creates the unified bridge factory with all app-level middleware.
 * This is the single entry point for creating graph API bridges.
 *
 * Middleware:
 * - usageTrackingMiddleware - Track LLM usage for billing
 *
 * NOTE: Context engineering was moved from stream middleware to node-level.
 * Stream middleware (IIFE pattern) breaks AsyncLocalStorage, which breaks:
 * - Polly.js recording/playback (test caching)
 * - Billing attribution (usage tracking)
 *
 * Nodes that need context injection should call `injectAgentContext()` directly.
 * See: app/api/middleware/context/injectAgentContext.ts
 */
import { createBridgeFactory } from "langgraph-ai-sdk";
import { usageTrackingMiddleware } from "./usageTracking";

export const createAppBridge = createBridgeFactory({
  middleware: [usageTrackingMiddleware],
});
