import { useEffect, useRef } from "react";
import { useChatFromContext } from "@components/shared/chat/ChatContext";
import { AgentIntentProcessor } from "@lib/AgentIntentProcessor";
import type { AgentIntent } from "@shared";

/**
 * Subscribe to a specific agent intent type. Handler fires exactly once per intent.
 *
 * Uses the chat instance's ~registerStateKeyCallback under the hood, which fires
 * ONLY when agentIntents changes — not on every SSE token. This eliminates the
 * re-render cascade that occurred with the previous useChatSelector approach.
 *
 * @example
 * ```tsx
 * // In any component inside Chat.Root:
 * subscribeToAgentIntent('social_links_saved', () => {
 *   queryClient.invalidateQueries({ queryKey: socialLinksKeys.all });
 * });
 * ```
 */
export function subscribeToAgentIntent(
  type: string,
  handler: (intent: AgentIntent) => void,
) {
  const chat = useChatFromContext();
  const processor = AgentIntentProcessor.forChat(chat);

  // Latest-ref pattern: stable subscription, always calls latest handler.
  // Callers don't need useCallback.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return processor.on(type, (intent) => {
      handlerRef.current(intent);
    });
  }, [processor, type]);
}
