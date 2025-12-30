import { useEffect, useRef, useMemo, useCallback } from "react";
import type { MessageBlock, InferBridgeData } from "langgraph-ai-sdk-types";
import { Brainstorm, type BrainstormBridgeType } from "@shared";
import {
  useBrainstormChatMessages,
  useBrainstormChatIsStreaming,
  useBrainstormChatState,
  useBrainstormChatActions,
} from "@hooks/useBrainstormChat";
import { Chat } from "@components/chat";
import { BrainstormMessage } from "./BrainstormMessage";
import { QuestionBadge } from "./QuestionBadge";
import { useBrainstormInput } from "./BrainstormInputContext";

// The LanggraphData type for the Brainstorm graph (used for MessageBlock generic)
type BrainstormLanggraphData = InferBridgeData<BrainstormBridgeType>;
type BrainstormBlock = MessageBlock<BrainstormLanggraphData>;

/**
 * User-friendly labels for each command
 */
const CommandLabels: Record<Brainstorm.CommandName, string> = {
  helpMe: "Help Me Answer",
  skip: "Skip This",
  doTheRest: "Do The Rest",
  finished: "Build My Site",
};

/**
 * Commands that should be styled as primary (more prominent action)
 */
const PrimaryCommands: Brainstorm.CommandName[] = ["finished", "doTheRest"];

/**
 * Displays the brainstorm message list.
 * Fetches messages and status directly via hooks.
 */
export function BrainstormMessages() {
  const messages = useBrainstormChatMessages();
  const isStreaming = useBrainstormChatIsStreaming();
  const availableCommands = useBrainstormChatState("availableCommands");
  const { sendMessage } = useBrainstormChatActions();
  const { setInput, textareaRef } = useBrainstormInput();

  const totalQuestions = Brainstorm.TotalQuestions;

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

  // Handle clicking on command buttons
  const handleCommandClick = useCallback((commandName: Brainstorm.CommandName) => {
    const prompt = Brainstorm.commandToPrompt(commandName);
    sendMessage(prompt);
  }, [sendMessage]);

  // Pre-compute message metadata in a single O(n) pass
  // Detect topic changes to show question badge on first message of each topic
  const messageMetadata = useMemo(() => {
    let lastSeenTopic: string | undefined;

    return messages.map((message, index) => {
      const isUser = message.role === "user";
      const isLastMessage = index === messages.length - 1;

      if (isUser) {
        return {
          isUser,
          isLastMessage,
          startsNewTopic: false,
          questionNumber: 0,
        };
      }

      // AI message - check if it starts a new topic
      const messageTopic = (message as any).metadata?.currentTopic as string | undefined;
      debugger;
      const startsNewTopic = Boolean(messageTopic && messageTopic !== lastSeenTopic);

      if (messageTopic) {
        lastSeenTopic = messageTopic;
      }

      return {
        isUser,
        isLastMessage,
        startsNewTopic,
        questionNumber: startsNewTopic ? Brainstorm.getQuestionNumberForTopic(messageTopic) : 0,
      };
    });
  }, [messages]);

  // Empty state is handled by parent component
  if (messages.length === 0) {
    return null;
  }

  return (
    <Chat.MessageList.Root className="flex-1 p-4 space-y-4 mx-auto" style={{ maxWidth: "808px" }}>
      {messages.map((message, index) => {
        const { isUser, isLastMessage, startsNewTopic, questionNumber } = messageMetadata[index];

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

        // Show command buttons only on last AI message when not streaming
        const showCommandButtons =
          isLastMessage &&
          !isStreaming &&
          availableCommands &&
          availableCommands.length > 0;

        return (
          <div key={message.id} className="space-y-3">
            {/* Question badge appears on first AI message of each topic */}
            {startsNewTopic && (
              <QuestionBadge current={questionNumber} total={totalQuestions} />
            )}
            <BrainstormMessage
              blocks={message.blocks as BrainstormBlock[]}
              isActive={isLastMessage}
              onExampleClick={handleExampleClick}
            />
            {/* Command buttons appear after last AI message */}
            {showCommandButtons && (
              <Chat.CommandButtons.Root>
                {availableCommands.map((commandName) => (
                  <Chat.CommandButtons.Button
                    key={commandName}
                    variant={PrimaryCommands.includes(commandName) ? "primary" : "secondary"}
                    onClick={() => handleCommandClick(commandName)}
                  >
                    {CommandLabels[commandName]}
                  </Chat.CommandButtons.Button>
                ))}
              </Chat.CommandButtons.Root>
            )}
          </div>
        );
      })}

      <div ref={messagesEndRef} />
    </Chat.MessageList.Root>
  );
}
