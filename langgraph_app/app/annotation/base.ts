import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import type { ErrorStateType, BaseMessage, PrimaryKeyType, ThreadIDType } from "@types";

export const BaseAnnotation = Annotation.Root({
  threadId: Annotation<ThreadIDType | undefined>(),

  error: Annotation<ErrorStateType | null>({
    default: () => null,
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
});
