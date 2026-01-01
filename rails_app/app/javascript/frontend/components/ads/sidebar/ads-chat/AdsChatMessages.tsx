import { useEffect, useRef } from "react";
import { Chat, useChatMessages, useChatIsStreaming } from "@components/chat/Chat";

/**
 * Props for the AdsChatMessagesView presentation component.
 */
export interface AdsChatMessagesViewProps {
  /** Array of chat messages to display */
  messages: Array<{
    id: string;
    role: "assistant" | "user" | "system";
    blocks: Array<{ id: string; type: string; text?: string }>;
  }>;
  /** Whether the chat is currently streaming a response */
  isStreaming: boolean;
}

/**
 * Pure presentation component for ads chat messages.
 * Uses Chat compound components for consistent styling.
 */
export function AdsChatMessagesView({ messages, isStreaming }: AdsChatMessagesViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll container to bottom without affecting parent scroll containers
    const container = containerRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  return (
    <Chat.MessageList.Root ref={containerRef} className="space-y-4">
      {messages.map((message, index) => {
        const isLastMessage = index === messages.length - 1;

        if (message.role === "user") {
          return <Chat.UserMessage key={message.id} blocks={message.blocks} className="text-xs" />;
        }

        if (message.role === "assistant") {
          // Check if message has any text content
          const textBlocks = message.blocks.filter((b) => b.type === "text" && b.text?.trim());
          const hasContent = textBlocks.length > 0;

          // Show thinking indicator for last message while streaming with no content
          if (!hasContent && isLastMessage && isStreaming) {
            return <Chat.ThinkingIndicator key={message.id} text="Thinking" className="text-xs" />;
          }

          // Render text blocks
          return textBlocks.map((block) => (
            <Chat.AIMessage.Content
              key={block.id}
              state={isLastMessage ? "active" : "inactive"}
              className="text-xs"
            >
              {block.text}
            </Chat.AIMessage.Content>
          ));
        }

        return null;
      })}
    </Chat.MessageList.Root>
  );
}

/**
 * Container component for ads chat messages.
 * Uses Chat context for portability and consistency.
 */
export default function AdsChatMessages() {
  const messages = useChatMessages();
  const isStreaming = useChatIsStreaming();

  return <AdsChatMessagesView messages={messages} isStreaming={isStreaming} />;
}
