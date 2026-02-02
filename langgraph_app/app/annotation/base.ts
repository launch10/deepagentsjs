import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import type {
  ErrorStateType,
  BaseMessage,
  PrimaryKeyType,
  ThreadIDType,
  CreditStatus,
  Intent,
} from "@types";

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
    reducer: messagesStateReducer,
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
