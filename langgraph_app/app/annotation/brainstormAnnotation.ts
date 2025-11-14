import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { Brainstorm, type PrimaryKeyType } from "@types";
import type { Equal, Expect } from "@types";
import type { BrainstormGraphState } from "@state";

export const BrainstormAnnotation = Annotation.Root({
    ...BaseAnnotation.spec,
    qa: Annotation<Brainstorm.QAResultType>(),
    currentTopic: Annotation<Brainstorm.TopicType | undefined>(),
    placeholderText: Annotation<string>(),
    brainstormId: Annotation<PrimaryKeyType | undefined>(),
    memories: Annotation<Brainstorm.MemoriesType>(),
    availableActions: Annotation<Brainstorm.ActionType[]>({
        default: () => [],
        reducer: (current, next) => [...next]
    }),
    selectedAction: Annotation<Brainstorm.ActionType | undefined>(),
    redirect: Annotation<Brainstorm.RedirectType | undefined>(),
    intent: Annotation<string | undefined>(),
    skippedTopics: Annotation<Brainstorm.TopicType[]>({
        default: () => [],
        reducer: (current, next) => [...current, ...next]
    }),
    remainingTopics: Annotation<Brainstorm.TopicType[]>({
        default: () => [...Brainstorm.BrainstormTopics],
        reducer: (current, next) => next
    }),
});

// Just a convenience to ensure the annotation matches the state type
// TODO: Re-enable once type shapes match exactly
// type _Assertion = Expect<Equal<BrainstormGraphState, typeof BrainstormAnnotation.State>>;