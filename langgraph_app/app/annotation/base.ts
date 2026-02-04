import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";

import type {
  ErrorStateType,
  BaseMessage,
  PrimaryKeyType,
  ThreadIDType,
  CreditStatus,
  Intent,
} from "@types";

/**
 * Custom messages reducer that wraps messagesStateReducer
 * and adds timestamps to AI messages for context engineering.
 */
function timestampedMessagesReducer(
  current: BaseMessage[],
  next: BaseMessage | BaseMessage[]
): BaseMessage[] {
  const messagesToAdd = Array.isArray(next) ? next : [next];

  // Add timestamp to AI messages that don't have one
  const timestampedMessages = messagesToAdd.map((msg) => {
    if (msg instanceof AIMessage || msg._getType?.() === "ai") {
      const responseMetadata = msg.response_metadata as Record<string, unknown> | undefined;
      const hasTimestamp =
        responseMetadata?.timestamp || msg.additional_kwargs?.timestamp;
      if (!hasTimestamp) {
        return new AIMessage({
          ...msg,
          response_metadata: {
            ...responseMetadata,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
    return msg;
  });

  return messagesStateReducer(current, timestampedMessages);
}

export const BaseAnnotation = Annotation.Root({
  threadId: Annotation<ThreadIDType | undefined>(),

  error: Annotation<ErrorStateType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  jwt: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: timestampedMessagesReducer,
  }),

  accountId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  projectId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  projectName: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  websiteId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Chat ID for thread ownership tracking (set by createChat nodes)
  chatId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),

  // Pre-run credit balance in millicredits (set by middleware)
  preRunCreditsRemaining: Annotation<number | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),

  // Credit status calculated at end of run (for frontend exhaustion notification)
  creditStatus: Annotation<CreditStatus | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),

  // Intent: user action that triggered this graph invocation
  // Consumed after handling (cleared by handler nodes)
  intent: Annotation<Intent | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),
});
