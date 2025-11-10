import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { 
    type Message, 
    type AIMessage, 
    type PrimaryKeyType,
    type ErrorStateType,
    Brainstorm, 
    Graphs, 
} from "@types";

export const BrainstormAnnotation = Annotation.Root({
    ...BaseAnnotation.spec,

    availableActions: Annotation<Brainstorm.ActionType[]>({
        default: () => [],
        reducer: (current, next) => next
    }),

    action: Annotation<Brainstorm.ActionType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    websiteId: Annotation<PrimaryKeyType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    })
});