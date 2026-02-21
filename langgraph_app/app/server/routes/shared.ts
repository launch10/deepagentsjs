/**
 * Shared Route Helpers
 *
 * Utilities shared across route handlers.
 */
import { notifyRailsEvent } from "@core";
import type { AuthContext } from "@server/middleware";

/**
 * Track a chat message event via Rails AppEvent.
 *
 * Fires only when `messages` is non-empty (real user messages).
 * StateOnly updates (like updateState() calls) pass messages: [] and are excluded.
 *
 * auth.accountId is actually the userId (JWT sub) despite the name.
 */
export function trackChatMessage(
  auth: AuthContext,
  messages: unknown[] | undefined,
  threadId: string,
  chatType: string,
  state?: Record<string, unknown>
) {
  if (!messages || messages.length === 0) return;

  notifyRailsEvent({
    eventName: "chat_message_sent",
    userId: auth.accountId,
    projectId: state?.projectId as number | undefined,
    properties: { chat_type: chatType, thread_id: threadId },
  });
}
