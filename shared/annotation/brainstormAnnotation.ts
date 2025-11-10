import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { Brainstorm } from "../types";

export const BrainstormAnnotation = Annotation.Root({
    ...BaseAnnotation.spec,
    memories: Annotation<Brainstorm.Memories>(),
    availableActions: Annotation<Brainstorm.Action[]>(),
    selectedAction: Annotation<Brainstorm.Action | undefined>(),
    remainingTopics: Annotation<Brainstorm.Topic[]>({
        default: () => [...Brainstorm.BrainstormTopics],
        reducer: (current, next) => next
    }),
});