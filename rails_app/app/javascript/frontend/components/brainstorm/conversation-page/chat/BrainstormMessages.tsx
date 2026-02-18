import { useMemo, useCallback } from "react";
import type { MessageBlock, InferBridgeData, AnyMessageWithBlocks } from "langgraph-ai-sdk-types";
import { ChatSelectors } from "langgraph-ai-sdk-react";
import { Brainstorm, type BrainstormBridgeType } from "@shared";
import { useBrainstormSelector } from "@components/brainstorm/hooks";
import { Chat } from "@components/shared/chat/Chat";
import { BrainstormAIMessage } from "./BrainstormAIMessage";
import { QuestionBadge } from "./QuestionBadge";

// The LanggraphData type for the Brainstorm graph (used for MessageBlock generic)
type BrainstormLanggraphData = InferBridgeData<BrainstormBridgeType>;
type BrainstormBlock = MessageBlock<BrainstormLanggraphData>;

/**
 * User-friendly labels for each intent
 */
const IntentLabels: Record<Brainstorm.BrainstormIntentName, string> = {
  help_me: "Help Me Answer",
  skip_topic: "Skip This",
  do_the_rest: "Do The Rest",
};

/**
 * Intents that should be styled as primary (more prominent action)
 */
const PrimaryIntents: Brainstorm.BrainstormIntentName[] = ["do_the_rest"];

/**
 * Props for the BrainstormMessagesView presentation component.
 * Contains all data and callbacks needed for rendering without hooks.
 */
export interface BrainstormMessagesViewProps {
  /** Array of chat messages to display */
  messages: AnyMessageWithBlocks[];
  /** Whether the chat is currently streaming a response */
  isStreaming: boolean;
  /** Available intent buttons to show */
  availableIntents: Brainstorm.BrainstormIntentName[];
  /** Callback when user clicks an intent button */
  onIntentClick: (intentName: Brainstorm.BrainstormIntentName) => void;
  /** Total number of questions in the brainstorm flow */
  totalQuestions?: number;
}

/**
 * Pure presentation component for brainstorm messages.
 * Renders the message list, question badges, and intent buttons.
 * Can be used in Storybook and unit tests without mocking hooks.
 */
export function BrainstormMessagesView({
  messages,
  isStreaming,
  availableIntents,
  onIntentClick,
  totalQuestions = Brainstorm.TotalQuestions,
}: BrainstormMessagesViewProps) {
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
      const messageTopic = (message as any).metadata?.currentTopic;
      const startsNewTopic = Boolean(messageTopic && messageTopic !== lastSeenTopic);

      if (messageTopic) {
        lastSeenTopic = messageTopic;
      }
      return {
        isUser,
        isLastMessage,
        startsNewTopic,
        questionNumber:
          startsNewTopic && messageTopic
            ? Brainstorm.getQuestionNumberForTopic(messageTopic as Brainstorm.TopicName)
            : 0,
      };
    });
  }, [messages]);

  // Empty state is handled by parent component
  if (messages.length === 0) {
    return null;
  }

  return (
    <Chat.Messages.List className="flex-1 py-4 max-w-3xl mx-auto">
      {messages.map((message, index) => {
        const { isUser, isLastMessage, startsNewTopic, questionNumber } = messageMetadata[index];

        // User messages - use blocks-aware UserMessage
        if (isUser) {
          return <Chat.UserMessage key={message.id} blocks={message.blocks} />;
        }

        // AI message - check if it has content
        const hasContent = message.blocks.some(
          (b) => b.type === "text" && "text" in b && b.text && b.text.trim()
        );

        if (!hasContent && isLastMessage && isStreaming) {
          return <Chat.ThinkingIndicator key={message.id} text="Thinking" />;
        }

        // Show intent buttons only on last AI message when not streaming
        const showIntentButtons =
          isLastMessage && !isStreaming && availableIntents && availableIntents.length > 0;

        return (
          <div key={message.id} data-role="assistant" className="space-y-3">
            {/* Question badge appears on first AI message of each topic */}
            {startsNewTopic && <QuestionBadge current={questionNumber} total={totalQuestions} />}
            <BrainstormAIMessage
              blocks={message.blocks as BrainstormBlock[]}
              isActive={isLastMessage}
            />
            {/* Intent buttons appear after last AI message */}
            {showIntentButtons && (
              <Chat.IntentButtons.Root>
                {availableIntents.map((intentName) => (
                  <Chat.IntentButtons.Button
                    key={intentName}
                    variant={PrimaryIntents.includes(intentName) ? "primary" : "secondary"}
                    onClick={() => onIntentClick(intentName)}
                  >
                    {IntentLabels[intentName]}
                  </Chat.IntentButtons.Button>
                ))}
              </Chat.IntentButtons.Root>
            )}
          </div>
        );
      })}

      <Chat.Messages.ScrollAnchor />
    </Chat.Messages.List>
  );
}

/**
 * Container component for brainstorm messages.
 * Fetches data via context hooks and delegates rendering to BrainstormMessagesView.
 * Now uses Chat context instead of direct brainstorm hooks for portability.
 */
export function BrainstormMessages() {
  const messages = useBrainstormSelector((s) => s.messages);
  const isStreaming = useBrainstormSelector(ChatSelectors.isStreaming);
  const sendMessage = useBrainstormSelector(ChatSelectors.sendMessage);
  const availableIntents = useBrainstormSelector((s) => s.state.availableIntents);

  // Handle clicking on intent buttons - sends the label as message text
  // and sets the intent in graph state
  const handleIntentClick = useCallback(
    (intentName: Brainstorm.BrainstormIntentName) => {
      const label = IntentLabels[intentName];
      sendMessage(label, {
        intent: {
          type: intentName,
          payload: {},
          createdAt: new Date().toISOString(),
        },
      });
    },
    [sendMessage]
  );

  return (
    <BrainstormMessagesView
      messages={messages as any}
      isStreaming={isStreaming}
      availableIntents={availableIntents ?? []}
      onIntentClick={handleIntentClick}
    />
  );
}
