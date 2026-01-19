import { useWebsiteChatActions } from "./useWebsiteChat";

/**
 * Hook that provides website chat actions for sending messages.
 *
 * @example
 * ```tsx
 * const { sendMessage } = useWebsiteSendMessage();
 * sendMessage("Update the hero section");
 * ```
 */
export function useWebsiteSendMessage() {
  return useWebsiteChatActions();
}
