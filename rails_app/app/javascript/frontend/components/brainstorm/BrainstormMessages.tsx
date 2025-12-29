import { useEffect, useRef } from "react";
import { useBrainstormChatMessages, useBrainstormChatStatus } from "@hooks/useBrainstormChat";
import { Chat } from "@components/chat";
import { BrainstormMessage } from "./BrainstormMessage";
import { QuestionBadge } from "./QuestionBadge";
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

  // Empty state is handled by parent component
  if (messages.length === 0) {
    return null;
  }

  // Count AI messages to determine question number
  const aiMessageCount = messages.filter((m) => m.role === "assistant").length;
  const currentQuestion = Math.max(1, aiMessageCount);
  const totalQuestions = 5; // Brainstorm has 5 questions

  return (
    <Chat.MessageList.Root className="flex-1 p-4 space-y-4">
      {messages.map((message, index) => {
        const isUser = message.role === "user";
        const isLastMessage = index === messages.length - 1;
        const isFirstAIMessage =
          !isUser && messages.slice(0, index).every((m) => m.role === "user");

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
            (b.type === "text" && "text" in b && b.text && b.text.trim()) || b.type === "structured"
        );

        if (!hasContent && isLastMessage && isStreaming) {
          return <Chat.ThinkingIndicator key={message.id} text="Thinking" />;
        }

        // Count which question this AI message represents
        const aiMessagesBeforeThis = messages
          .slice(0, index)
          .filter((m) => m.role === "assistant").length;
        const questionNumber = aiMessagesBeforeThis + 1;

        return (
          <div key={message.id} className="space-y-3">
            {/* Question badge appears before AI message content */}
            <QuestionBadge current={questionNumber} total={totalQuestions} />
            <BrainstormMessage
              blocks={message.blocks as any}
              isActive={isLastMessage}
              onExampleClick={handleExampleClick}
            />
          </div>
        );
      })}

      <div ref={messagesEndRef} />
    </Chat.MessageList.Root>
  );
}
