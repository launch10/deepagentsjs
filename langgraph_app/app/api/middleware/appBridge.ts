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
 * Context engineering lives in app/conversation/. Conversation preparation
 * (event fetching, context injection, windowing, compaction) is handled via
 * Conversation.start() inside each agent node.
 */
import { createBridgeFactory } from "langgraph-ai-sdk";
import { usageTrackingMiddleware } from "./usageTracking";

export const createAppBridge = createBridgeFactory({
  middleware: [usageTrackingMiddleware],
});
