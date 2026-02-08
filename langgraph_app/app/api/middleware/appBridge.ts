/**
 * App Bridge Factory
 *
 * Creates the unified bridge factory with all app-level middleware.
 * This is the single entry point for creating graph API bridges.
 *
 * Middleware:
 * - usageTrackingMiddleware - Track LLM usage for billing
 *
 * NOTE: loggingMiddleware is defined but not yet wired in — rootLogger
 * resolves to undefined in test/vitest due to module initialization order.
 * Wire it in after the circular-init issue in @core/logger is fixed.
 *
 * Context engineering was moved from stream middleware to node-level.
 * Nodes that need context injection should call `injectAgentContext()` directly.
 * See: app/api/middleware/context/injectAgentContext.ts
 */
import { createBridgeFactory } from "langgraph-ai-sdk";
import { usageTrackingMiddleware } from "./usageTracking";

export const createAppBridge = createBridgeFactory({
  middleware: [usageTrackingMiddleware],
});
