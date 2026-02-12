import { useEffect, useRef } from "react";
import { Chat } from "@components/shared/chat/Chat";
import { useChatMessages, useChatIsStreaming } from "@components/shared/chat/ChatContext";
import { useWebsiteChatState } from "@hooks/website";
import type { Todo } from "@shared";

/**
 * Props for the WebsiteChatMessagesView presentation component.
 */
export interface WebsiteChatMessagesViewProps {
  /** Array of chat messages to display */
  messages: Array<{
    id: string;
    role: "assistant" | "user" | "system";
    blocks: Array<{ id: string; type: string; text?: string }>;
  }>;
  /** Whether the chat is currently streaming a response */
  isStreaming: boolean;
  /** Optional todos to display inline at the bottom of the message list */
  todos?: Todo[];
}

/**
 * Pure presentation component for website chat messages.
 * Uses Chat compound components for consistent styling.
 * Follows the same pattern as BrainstormMessages.
 */
export function WebsiteChatMessagesView({ messages, isStreaming, todos }: WebsiteChatMessagesViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll container to bottom without affecting parent scroll containers
    const container = containerRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Show thinking indicator when streaming with no messages yet
  // This handles the initial load case where backend is generating response
  if (messages.length === 0 && isStreaming) {
    return <Chat.ThinkingIndicator text="Building your website" className="text-xs" />;
  }

  // Empty state when not streaming - waiting for backend to start
  if (messages.length === 0) {
    return <Chat.ThinkingIndicator text="Getting ready" className="text-xs" />;
  }

  return (
    <Chat.Messages.List ref={containerRef}>
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
      {isStreaming && todos && todos.length > 0 && (
        <Chat.TodoList todos={todos} className="text-xs" />
      )}
    </Chat.Messages.List>
  );
}

/**
 * Container component for website chat messages.
 * Uses Chat context for portability and consistency.
 */
export default function WebsiteChatMessages() {
  const messages = useChatMessages();
  const isStreaming = useChatIsStreaming();
  const todos = useWebsiteChatState("todos");

  return <WebsiteChatMessagesView messages={messages} isStreaming={isStreaming} todos={todos} />;
}
