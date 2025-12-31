import { useEffect, useRef, useMemo, useCallback } from "react";
import type { MessageBlock, InferBridgeData, MessageWithBlocks, LanggraphData, ValidGraphState, ImageMessageBlock } from "langgraph-ai-sdk-types";
import { Brainstorm, type BrainstormBridgeType } from "@shared";
import { useBrainstormChatState } from "@hooks/useBrainstormChat";
import { Chat, useChatMessages, useChatIsStreaming, useChatSendMessage, useChatComposer } from "@components/chat";
import { BrainstormMessage } from "./BrainstormMessage";
import { QuestionBadge } from "./QuestionBadge";
import { getTextareaRef } from "@lib/brainstormTextarea";
import { MessageImages } from "./attachments/MessageImages";

// The LanggraphData type for the Brainstorm graph (used for MessageBlock generic)
type BrainstormLanggraphData = InferBridgeData<BrainstormBridgeType>;
type BrainstormBlock = MessageBlock<BrainstormLanggraphData>;
// Use the generic message type that ChatSnapshot returns (not the specific Brainstorm type)
// to avoid type compatibility issues between the specific and generic LanggraphData types
type BrainstormMessage_ = MessageWithBlocks<LanggraphData<ValidGraphState, undefined>>;

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
 * Props for the BrainstormMessagesView presentation component.
 * Contains all data and callbacks needed for rendering without hooks.
 */
export interface BrainstormMessagesViewProps {
  /** Array of chat messages to display */
  messages: BrainstormMessage_[];
  /** Whether the chat is currently streaming a response */
  isStreaming: boolean;
  /** Available command buttons to show (e.g., helpMe, skip, doTheRest, finished) */
  availableCommands: Brainstorm.CommandName[];
  /** Callback when user clicks an example suggestion */
  onExampleClick: (text: string) => void;
  /** Callback when user clicks a command button */
  onCommandClick: (command: Brainstorm.CommandName) => void;
  /** Total number of questions in the brainstorm flow */
  totalQuestions?: number;
}

/**
 * Pure presentation component for brainstorm messages.
 * Renders the message list, question badges, and command buttons.
 * Can be used in Storybook and unit tests without mocking hooks.
 */
export function BrainstormMessagesView({
  messages,
  isStreaming,
  availableCommands,
  onExampleClick,
  onCommandClick,
  totalQuestions = Brainstorm.TotalQuestions,
}: BrainstormMessagesViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      const messageTopic = message.metadata?.currentTopic;
      const startsNewTopic = Boolean(messageTopic && messageTopic !== lastSeenTopic);

      if (messageTopic) {
        lastSeenTopic = messageTopic;
      }
      return {
        isUser,
        isLastMessage,
        startsNewTopic,
        questionNumber: startsNewTopic && messageTopic ? Brainstorm.getQuestionNumberForTopic(messageTopic as Brainstorm.TopicName) : 0,
      };
    });
  }, [messages]);

  // Empty state is handled by parent component
  if (messages.length === 0) {
    return null;
  }

  return (
    <Chat.MessageList.Root className="flex-1 py-4 space-y-4 max-w-3xl mx-auto">
      {messages.map((message, index) => {
        const { isUser, isLastMessage, startsNewTopic, questionNumber } = messageMetadata[index];

        if (isUser) {
          const textContent = message.blocks
            .filter((b) => b.type === "text")
            .map((b) => ("text" in b ? b.text : ""))
            .join("");
          const imageBlocks = message.blocks.filter(
            (b): b is ImageMessageBlock => b.type === "image"
          );

          return (
            <div key={message.id} className="flex flex-col items-end">
              <Chat.UserMessage>
                {textContent}
              </Chat.UserMessage>
              {imageBlocks.length > 0 && <MessageImages images={imageBlocks} />}
            </div>
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
              onExampleClick={onExampleClick}
            />
            {/* Command buttons appear after last AI message */}
            {showCommandButtons && (
              <Chat.CommandButtons.Root>
                {availableCommands.map((commandName) => (
                  <Chat.CommandButtons.Button
                    key={commandName}
                    variant={PrimaryCommands.includes(commandName) ? "primary" : "secondary"}
                    onClick={() => onCommandClick(commandName)}
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

/**
 * Container component for brainstorm messages.
 * Fetches data via context hooks and delegates rendering to BrainstormMessagesView.
 * Now uses Chat context instead of direct brainstorm hooks for portability.
 */
export function BrainstormMessages() {
  // Use context hooks (requires Chat.Root ancestor)
  // Cast messages to the expected type - the underlying data is compatible
  const messages = useChatMessages() as unknown as BrainstormMessage_[];
  const isStreaming = useChatIsStreaming();
  const sendMessage = useChatSendMessage();
  const composer = useChatComposer();

  // Brainstorm-specific state (available commands comes from backend)
  const availableCommands = useBrainstormChatState("availableCommands");

  // Handle clicking on example suggestions - memoized to prevent unnecessary re-renders
  const handleExampleClick = useCallback(
    (text: string) => {
      composer.setText(text);
      const textareaRef = getTextareaRef();
      textareaRef.current?.focus();
    },
    [composer]
  );

  // Handle clicking on command buttons
  const handleCommandClick = useCallback(
    (commandName: Brainstorm.CommandName) => {
      const prompt = Brainstorm.commandToPrompt(commandName);
      sendMessage(prompt);
    },
    [sendMessage]
  );

  return (
    <BrainstormMessagesView
      messages={messages}
      isStreaming={isStreaming}
      availableCommands={availableCommands ?? []}
      onExampleClick={handleExampleClick}
      onCommandClick={handleCommandClick}
    />
  );
}
