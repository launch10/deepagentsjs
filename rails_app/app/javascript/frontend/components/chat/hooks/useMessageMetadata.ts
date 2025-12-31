import { useMemo } from "react";

// ============================================================================
// useMessageMetadata Hook
// ============================================================================
// Computes common metadata for a list of messages in a single O(n) pass.
// Provides position info (isFirst, isLast) and role detection that can be
// extended by domain-specific hooks.
//
// Example:
//   const metadata = useMessageMetadata(messages);
//   metadata[0].isFirstMessage // true
//   metadata[metadata.length - 1].isLastMessage // true
// ============================================================================

export interface MessageMetadata {
  /** Message index in the array */
  index: number;
  /** Whether this is a user message */
  isUser: boolean;
  /** Whether this is the first message */
  isFirstMessage: boolean;
  /** Whether this is the last message */
  isLastMessage: boolean;
  /** Whether this is the first user message */
  isFirstUserMessage: boolean;
  /** Whether this is the last user message */
  isLastUserMessage: boolean;
  /** Whether this is the first AI message */
  isFirstAIMessage: boolean;
  /** Whether this is the last AI message */
  isLastAIMessage: boolean;
}

interface MinimalMessage {
  role: string;
}

/**
 * Computes metadata for each message in a list.
 * Memoized for performance during streaming.
 */
export function useMessageMetadata<T extends MinimalMessage>(
  messages: T[]
): MessageMetadata[] {
  return useMemo(() => {
    // Find first/last indices for user and AI messages
    let firstUserIndex = -1;
    let lastUserIndex = -1;
    let firstAIIndex = -1;
    let lastAIIndex = -1;

    for (let i = 0; i < messages.length; i++) {
      const isUser = messages[i].role === "user";
      if (isUser) {
        if (firstUserIndex === -1) firstUserIndex = i;
        lastUserIndex = i;
      } else {
        if (firstAIIndex === -1) firstAIIndex = i;
        lastAIIndex = i;
      }
    }

    return messages.map((message, index) => {
      const isUser = message.role === "user";
      return {
        index,
        isUser,
        isFirstMessage: index === 0,
        isLastMessage: index === messages.length - 1,
        isFirstUserMessage: index === firstUserIndex,
        isLastUserMessage: index === lastUserIndex,
        isFirstAIMessage: index === firstAIIndex,
        isLastAIMessage: index === lastAIIndex,
      };
    });
  }, [messages]);
}
