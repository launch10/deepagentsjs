import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { Brainstorm, type PrimaryKeyType } from "@types";
import type { Equal, Expect, ShowMismatches, UUIDType } from "@types";
import type { BrainstormGraphState } from "@state";
import { uniq } from "@utils";
import { createAppBridge } from "@api/middleware";

/**
 * Mode type for tracking brainstorm state across turns.
 * Must match BrainstormMode from contextMessages.ts
 */
type BrainstormModeType = "default" | "helpMe" | "doTheRest" | "uiGuidance" | "finishSkipped";

export const BrainstormAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,
  projectUUID: Annotation<UUIDType>(),
  currentTopic: Annotation<Brainstorm.TopicName | undefined>(),
  placeholderText: Annotation<string>(),
  brainstormId: Annotation<PrimaryKeyType | undefined>(),
  memories: Annotation<Brainstorm.MemoriesType>(),
  availableCommands: Annotation<Brainstorm.CommandName[]>({
    default: () => [],
    reducer: (current, next) => [...next],
  }),
  command: Annotation<Brainstorm.CommandName | undefined>(),
  redirect: Annotation<Brainstorm.RedirectType | undefined>(),
  skippedTopics: Annotation<Brainstorm.TopicName[]>({
    default: () => [],
    reducer: (current, next) => uniq(next),
  }),
  remainingTopics: Annotation<Brainstorm.TopicName[]>({
    default: () => [...Brainstorm.BrainstormTopics],
    reducer: (current, next) => next,
  }),
  /**
   * Tracks the brainstorm mode across turns for context message injection.
   * Used to detect mode switches (e.g., conversational → uiGuidance).
   */
  brainstormMode: Annotation<BrainstormModeType | undefined>(),
});

// Ensure the annotation matches the state type
// Hover over _Mismatches to see which fields differ when this fails
type _Mismatches = ShowMismatches<BrainstormGraphState, typeof BrainstormAnnotation.State>;
type _Assertion = Expect<Equal<BrainstormGraphState, typeof BrainstormAnnotation.State>>;

// Bridge for streaming frontend - uses createAppBridge for automatic usage tracking
export const BrainstormBridge = createAppBridge({
  endpoint: "/api/brainstorm/stream",
  stateAnnotation: BrainstormAnnotation,
  messageSchema: Brainstorm.structuredMessageSchemas,
  jsonTarget: "messages",
});
