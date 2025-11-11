import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { Brainstorm, type PrimaryKeyType } from "@types";

export const BrainstormAnnotation = Annotation.Root({
    ...BaseAnnotation.spec,
    brainstormId: Annotation<PrimaryKeyType | undefined>(),
    memories: Annotation<Brainstorm.Memories>(),
    availableActions: Annotation<Brainstorm.Action[]>(),
    selectedAction: Annotation<Brainstorm.Action | undefined>(),
    remainingTopics: Annotation<Brainstorm.Topic[]>({
        default: () => [...Brainstorm.BrainstormTopics],
        reducer: (current, next) => next
    }),
});