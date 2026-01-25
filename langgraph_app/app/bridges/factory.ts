/**
 * App Bridge Factory
 *
 * Creates bridges with app-level middleware baked in.
 * All bridges created through this factory automatically get usage tracking.
 *
 * @example
 * ```ts
 * // In annotation files:
 * export const BrainstormBridge = createAppBridge({
 *   endpoint: "/api/brainstorm/stream",
 *   stateAnnotation: BrainstormAnnotation,
 *   messageSchema: Brainstorm.structuredMessageSchemas,
 *   jsonTarget: "messages",
 * });
 *
 * // In routes:
 * BrainstormAPI.stream({
 *   messages,
 *   threadId,
 *   context: { chatId },  // Required for billing
 *   state: { jwt: auth.jwt }
 * });
 * ```
 */
import { createBridgeFactory } from "langgraph-ai-sdk";
import { usageTrackingMiddleware } from "./middleware";

/**
 * App bridge factory with usage tracking middleware.
 *
 * All bridges created with this factory will automatically:
 * - Track LLM usage via AsyncLocalStorage
 * - Persist usage records to the database
 * - Persist message traces for debugging
 * - Notify Rails to charge credits
 */
export const createAppBridge = createBridgeFactory({
  middleware: [usageTrackingMiddleware],
});
