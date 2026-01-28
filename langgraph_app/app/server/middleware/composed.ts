/**
 * Composed Middleware
 *
 * Pre-composed middleware chains for common route patterns.
 * These reduce duplication and ensure consistent middleware ordering.
 */
import { authMiddleware } from "./auth";
import { creditCheckMiddleware } from "./creditCheck";

/**
 * Middleware chain for stream routes that make LLM calls.
 *
 * Includes:
 * 1. authMiddleware - Validates JWT and sets auth context
 * 2. creditCheckMiddleware - Checks credit balance before proceeding
 *
 * Usage:
 *   import { streamMiddleware } from "@server/middleware";
 *   app.post("/stream", ...streamMiddleware, async (c) => { ... });
 */
export const streamMiddleware = [authMiddleware, creditCheckMiddleware] as const;

/**
 * Middleware chain for read-only routes (no LLM calls).
 *
 * Includes:
 * 1. authMiddleware - Validates JWT and sets auth context
 *
 * Usage:
 *   import { readOnlyMiddleware } from "@server/middleware";
 *   app.get("/stream", ...readOnlyMiddleware, async (c) => { ... });
 */
export const readOnlyMiddleware = [authMiddleware] as const;
