/**
 * Graph APIs
 *
 * This module exports bound graph APIs ready for use in routes.
 * Usage tracking is built into the bridges via createAppBridge.
 *
 * Routes should pass `chatId` via the `context` option:
 * @example
 * ```typescript
 * import { BrainstormAPI } from "@api";
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

export { BrainstormAPI } from "./brainstorm";
export { WebsiteAPI } from "./website";
export { AdsAPI } from "./ads";
export { DeployAPI } from "./deploy";
