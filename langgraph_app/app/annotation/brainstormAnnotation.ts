import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { Brainstorm, type PrimaryKeyType } from "@types";
import type { Equal, Expect, UUIDType } from "@types";
import type { BrainstormGraphState } from "@state";
import { uniq } from "@utils";

export const BrainstormAnnotation = Annotation.Root({
    ...BaseAnnotation.spec,
    projectUUID: Annotation<UUIDType>(),
    currentTopic: Annotation<Brainstorm.TopicName | undefined>(),
    placeholderText: Annotation<string>(),
    brainstormId: Annotation<PrimaryKeyType | undefined>(),
    memories: Annotation<Brainstorm.MemoriesType>(),
    availableCommands: Annotation<Brainstorm.CommandName[]>({
        default: () => [],
        reducer: (current, next) => [...next]
    }),
    command: Annotation<Brainstorm.CommandName | undefined>(),
    redirect: Annotation<Brainstorm.RedirectType | undefined>(),
    skippedTopics: Annotation<Brainstorm.TopicName[]>({
        default: () => [],
        reducer: (current, next) => uniq(next),
    }),
    remainingTopics: Annotation<Brainstorm.TopicName[]>({
        default: () => [...Brainstorm.BrainstormTopics],
        reducer: (current, next) => next
    }),
});

// Just a convenience to ensure the annotation matches the state type
type _Assertion = Expect<Equal<BrainstormGraphState, typeof BrainstormAnnotation.State>>;