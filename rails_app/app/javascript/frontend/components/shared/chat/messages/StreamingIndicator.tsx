import { useChatIsStreaming } from "../ChatContext";
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
 * Chat.Messages.StreamingIndicator - Shows thinking indicator while streaming.
 *
 * Renders beneath other messages whenever the chat is streaming.
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
  const isStreaming = useChatIsStreaming()

  if (!isStreaming) return null;

  return <ThinkingIndicator text={text} className={className} variant={variant} />;
}
