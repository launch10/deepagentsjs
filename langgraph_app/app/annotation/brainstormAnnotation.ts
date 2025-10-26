import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { Brainstorm, Graphs, isHumanMessage, type Message, type PrimaryKeyType } from "@types";

export const BrainstormAnnotation = Annotation.Root({
    error: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    jwt: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    accountId: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    messages: Annotation<Message[], Message[]>({
        default: () => [],
        reducer: (existing, incoming) => {
            if (Array.isArray(incoming) && incoming.length > 0 && incoming.length > existing.length) {
                const firstQuestion: AIMessage = Brainstorm.getFirstQuestion();
                const incomingQuestion = incoming[0];
                if (!incomingQuestion || !isHumanMessage(incomingQuestion)) {
                    return incoming;
                }
                const hasFirstQuestion = incomingQuestion.content === firstQuestion.content;
                if (hasFirstQuestion && existing.length > 0 && existing[0]?.content !== firstQuestion.content) {
                    return incoming;
                }
            }
            return messagesStateReducer(existing, incoming) as unknown as Message[];
        }
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