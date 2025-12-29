import { useEffect, useRef, useMemo, useCallback } from "react";
import type { MessageBlock, InferBridgeData } from "langgraph-ai-sdk-types";
import { Brainstorm, type BrainstormBridgeType } from "@shared";
import { useBrainstormChatMessages, useBrainstormChatIsStreaming } from "@hooks/useBrainstormChat";
import { Chat } from "@components/chat";
import { BrainstormMessage } from "./BrainstormMessage";
import { QuestionBadge } from "./QuestionBadge";
import { useBrainstormInput } from "./BrainstormInputContext";

// The LanggraphData type for the Brainstorm graph (used for MessageBlock generic)
type BrainstormLanggraphData = InferBridgeData<BrainstormBridgeType>;
type BrainstormBlock = MessageBlock<BrainstormLanggraphData>;

/**
 * Displays the brainstorm message list.
 * Fetches messages and status directly via hooks.
 */
export function BrainstormMessages() {
  const messages = useBrainstormChatMessages();
  const isStreaming = useBrainstormChatIsStreaming();
  const { setInput, textareaRef } = useBrainstormInput();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle clicking on example suggestions - memoized to prevent unnecessary re-renders
  const handleExampleClick = useCallback((text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  }, [setInput, textareaRef]);

  // Pre-compute message metadata in a single O(n) pass instead of O(n^2)
  const messageMetadata = useMemo(() => {
    let aiCount = 0;
    return messages.map((message, index) => {
      const isUser = message.role === "user";
      if (!isUser) aiCount++;
      return {
        isUser,
        isLastMessage: index === messages.length - 1,
        questionNumber: isUser ? 0 : aiCount,
        isFirstAIMessage: !isUser && aiCount === 1,
      };
    });
  }, [messages]);

  // Empty state is handled by parent component
  if (messages.length === 0) {
    return null;
  }

  const totalQuestions = Brainstorm.BrainstormTopics.length;

  return (
    <Chat.MessageList.Root className="flex-1 p-4 space-y-4">
      {messages.map((message, index) => {
        const { isUser, isLastMessage, questionNumber } = messageMetadata[index];

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

        return (
          <div key={message.id} className="space-y-3">
            {/* Question badge appears before AI message content */}
            <QuestionBadge current={questionNumber} total={totalQuestions} />
            <BrainstormMessage
              blocks={message.blocks as BrainstormBlock[]}
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
