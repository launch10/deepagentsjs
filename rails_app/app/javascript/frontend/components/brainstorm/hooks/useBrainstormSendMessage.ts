import { useBrainstormChatActions } from "./useBrainstormChat";

/**
 * Hook that provides brainstorm chat actions.
 *
 * URL-as-Truth: When the first message is sent, the chat hook receives the new
 * threadId from the backend and updates the URL via onThreadIdAvailable.
 * The workflow store derives its state from URL, so no manual sync is needed.
 *
 * @example
 * ```tsx
 * const { sendMessage } = useBrainstormSendMessage();
 * sendMessage("Hello!");
 * ```
 */
export function useBrainstormSendMessage() {
  return useBrainstormChatActions();
}