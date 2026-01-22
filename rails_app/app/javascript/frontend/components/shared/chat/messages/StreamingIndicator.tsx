import { useChatIsStreaming, useChatMessages } from "../ChatContext";
import { ThinkingIndicator } from "../ThinkingIndicator";

import type { ThinkingIndicatorVariant } from "../ThinkingIndicator";

export interface StreamingIndicatorProps {
  /**
   * Text to show while thinking.
   * @default "Thinking"
   */
  text?: string;
  /**
   * Additional className for styling.
   */
  className?: string;
  /**
   * Variant for the indicator.
   * @default "default"
   */
  variant?: ThinkingIndicatorVariant;
}

/**
 * Chat.Messages.StreamingIndicator - Auto-shows when appropriate.
 *
 * Uses context to determine when to show the thinking indicator:
 * - When streaming
 * - When the last message is an AI message with no content yet
 *
 * @example
 * ```tsx
 * <Chat.Messages.List>
 *   {messages.map(...)}
 *   <Chat.Messages.StreamingIndicator text="Thinking" />
 * </Chat.Messages.List>
 * ```
 */
export function StreamingIndicator({
  text = "Thinking",
  className,
  variant = "default",
}: StreamingIndicatorProps) {
  const messages = useChatMessages()
  const isStreaming = useChatIsStreaming()

  // Only show if streaming AND last message is AI with no content
  const lastMessage = messages[messages.length - 1];
  const showIndicator =
    isStreaming &&
    lastMessage?.role === "assistant" &&
    !lastMessage.blocks.some(
      (b) => b.type === "text" && "text" in b && b.text?.trim()
    );

  if (!showIndicator) return null;

  return <ThinkingIndicator text={text} className={className} variant={variant} />;
}
