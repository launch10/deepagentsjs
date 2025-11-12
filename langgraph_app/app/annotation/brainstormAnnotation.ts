import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { Brainstorm, type PrimaryKeyType } from "@types";
import type { Equal, Expect } from "@types";
import type { BrainstormGraphState } from "@state";

export const BrainstormAnnotation = Annotation.Root({
    ...BaseAnnotation.spec,
    currentTopic: Annotation<Brainstorm.TopicType | undefined>(),
    placeholderText: Annotation<string>(),
    brainstormId: Annotation<PrimaryKeyType | undefined>(),
    memories: Annotation<Brainstorm.MemoriesType>(),
    availableActions: Annotation<Brainstorm.ActionType[]>(),
    selectedAction: Annotation<Brainstorm.ActionType | undefined>(),
    remainingTopics: Annotation<Brainstorm.TopicType[]>({
        default: () => [...Brainstorm.BrainstormTopics],
        reducer: (current, next) => next
    }),
});

// Just a convenience to ensure the annotation matches the state type
type _Assertion = Expect<Equal<BrainstormGraphState, typeof BrainstormAnnotation.State>>;