/**
 * App Bridge Factory
 *
 * Creates the unified bridge factory with all app-level middleware.
 * This is the single entry point for creating graph API bridges.
 *
 * Middleware order:
 * 1. contextEngineeringMiddleware - Inject context events before processing
 * 2. usageTrackingMiddleware - Track LLM usage for billing
 */
import { createBridgeFactory } from "langgraph-ai-sdk";
import { contextEngineeringMiddleware } from "./context";
import { usageTrackingMiddleware } from "./usageTracking";

export const createAppBridge = createBridgeFactory({
  middleware: [contextEngineeringMiddleware, usageTrackingMiddleware],
});
