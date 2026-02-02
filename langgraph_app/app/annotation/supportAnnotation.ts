import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { createAppBridge } from "@api/middleware";

/**
 * Support Graph Annotation
 *
 * Defines the state shape for the support chat graph.
 * Extends BaseAnnotation with FAQ context for the AI assistant.
 */
export const SupportAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  // FAQ content loaded from the database, injected into the system prompt
  faqContext: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),
});

export type SupportGraphState = typeof SupportAnnotation.State;

// Bridge for streaming frontend - uses createAppBridge for automatic usage tracking
export const SupportBridge = createAppBridge({
  endpoint: "/api/support/stream",
  stateAnnotation: SupportAnnotation,
});
