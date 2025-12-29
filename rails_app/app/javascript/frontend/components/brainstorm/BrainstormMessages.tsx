import { useEffect, useRef } from "react";
import {
  useBrainstormChatMessages,
  useBrainstormChatStatus,
} from "@hooks/useBrainstormChat";
import { Chat } from "@components/chat";
import { BrainstormMessage } from "./BrainstormMessage";
import { useBrainstormInput } from "./BrainstormInputContext";

/**
 * Displays the brainstorm message list.
 * Fetches messages and status directly via hooks.
 */
export function BrainstormMessages() {
  const messages = useBrainstormChatMessages();
  const status = useBrainstormChatStatus();
  const { setInput, textareaRef } = useBrainstormInput();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isStreaming = status === "streaming" || status === "submitted";

  // Handle clicking on example suggestions
  const handleExampleClick = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  return (
    <Chat.MessageList.Root className="flex-1 p-4">
      {messages.length === 0 && (
        <div className="text-center text-neutral-500 py-12">
          <h1 className="text-2xl font-semibold mb-2">Let's brainstorm your business idea</h1>
          <p className="text-sm">
            Tell me about your business, and I'll help you create compelling marketing copy.
          </p>
        </div>
      )}

      {messages.map((message, index) => {
        const isUser = message.role === "user";
        const isLastMessage = index === messages.length - 1;

        if (isUser) {
          return (
            <Chat.UserMessage key={message.id}>
              {message.blocks
                .filter((b) => b.type === "text")
                .map((b) => ("text" in b ? b.text : ""))
                .join("")}
            </Chat.UserMessage>
          );
        }

        // AI message - check if it has content
        const hasContent = message.blocks.some(
          (b) =>
            (b.type === "text" && "text" in b && b.text && b.text.trim()) ||
            b.type === "structured"
        );

        if (!hasContent && isLastMessage && isStreaming) {
          return <Chat.ThinkingIndicator key={message.id} text="Thinking" />;
        }

        return (
          <BrainstormMessage
            key={message.id}
            blocks={message.blocks as any}
            isActive={isLastMessage}
            onExampleClick={handleExampleClick}
          />
        );
      })}

      <div ref={messagesEndRef} />
    </Chat.MessageList.Root>
  );
}
