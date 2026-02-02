import { BaseAnnotation } from "./base";
import { createAppBridge } from "@api/middleware";

/**
 * Support Graph Annotation
 *
 * Defines the state shape for the support chat graph.
 * Extends BaseAnnotation for the AI assistant.
 */
export const SupportAnnotation = BaseAnnotation;

export type SupportGraphState = typeof SupportAnnotation.State;

// Bridge for streaming frontend - uses createAppBridge for automatic usage tracking
export const SupportBridge = createAppBridge({
  endpoint: "/api/support/stream",
  stateAnnotation: SupportAnnotation,
});
