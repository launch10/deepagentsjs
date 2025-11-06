import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { 
    type Message, 
    type AIMessage, 
    type PrimaryKeyType,
    type ErrorStateType,
    Brainstorm, 
    Graphs, 
} from "@types";

export const BrainstormAnnotation = Annotation.Root({
    error: Annotation<ErrorStateType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    jwt: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    accountId: Annotation<number | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    projectId: Annotation<number | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    projectName: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    messages: Annotation<Message[]>({
        default: () => [],
        reducer: messagesStateReducer as any
    }),

    nextQuestion: Annotation<Brainstorm.QuestionType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    availableActions: Annotation<Brainstorm.ActionType[]>({
        default: () => [],
        reducer: (current, next) => next
    }),

    action: Annotation<Brainstorm.ActionType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    questionIndex: Annotation<number>({
        default: () => 0,
        reducer: (current, next) => next
    }),

    isValidAnswer: Annotation<boolean | undefined>({
        default: () => true,
        reducer: (current, next) => next
    }),

    route: Annotation<Brainstorm.RouteType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    redirect: Annotation<Graphs.RouteType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),
    
    projectId: Annotation<PrimaryKeyType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    websiteId: Annotation<PrimaryKeyType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    })
});