import { useEffect, useRef } from "react";
import { useChatMessages } from "../ChatContext";

export interface ScrollAnchorProps {
  /**
   * Scroll behavior.
   * @default "smooth"
   */
  behavior?: ScrollBehavior;
  /**
   * Whether to disable auto-scrolling.
   * @default false
   */
  disabled?: boolean;
}

/**
 * Chat.Messages.ScrollAnchor - Auto-scrolls to bottom on new messages.
 *
 * Place at the end of your message list to automatically scroll into view
 * when new messages arrive.
 *
 * @example
 * ```tsx
 * <Chat.Messages.List>
 *   {messages.map(...)}
 *   <Chat.Messages.ScrollAnchor />
 * </Chat.Messages.List>
 * ```
 */
export function ScrollAnchor({
  behavior = "smooth",
  disabled = false,
}: ScrollAnchorProps) {
  const messages = useChatMessages()
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) return;
    anchorRef.current?.scrollIntoView({ behavior });
  }, [messages, behavior, disabled]);

  return <div ref={anchorRef} aria-hidden="true" />;
}
