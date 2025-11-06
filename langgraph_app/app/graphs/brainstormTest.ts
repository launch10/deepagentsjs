import { StateGraph, END, START, Annotation, messagesStateReducer } from "@langchain/langgraph";
import { type Message } from "@langchain/core/messages";
import { graphParams } from "@core";
import { brainstormAgent } from "../nodes/brainstorm/agent";
import type { WebsiteType, LangGraphRunnableConfig } from "@types";
import { db, websites as websitesTable } from "@db";

// Simple annotation matching the agent's expected state
const brainstormTopics = ["idea", "audience", "solution", "socialProof", "lookAndFeel"] as const;
type BrainstormTopic = typeof brainstormTopics[number];
type Brainstorm = Partial<Record<BrainstormTopic, string>>;

export const BrainstormTestAnnotation = Annotation.Root({
    messages: Annotation<Message[]>({
        default: () => [],
        reducer: messagesStateReducer as any
    }),

    brainstorm: Annotation<Brainstorm>({
        default: () => ({}),
        reducer: (current, next) => ({ ...current, ...next })
    }),

    remainingTopics: Annotation<BrainstormTopic[]>({
        default: () => [...brainstormTopics],
        reducer: (current, next) => next
    }),

    website: Annotation<WebsiteType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    })
});

type BrainstormState = typeof BrainstormTestAnnotation.State;

const setupNode = async (state: BrainstormState, config?: LangGraphRunnableConfig) => {
    if (!config?.configurable?.thread_id) {
        throw new Error("Thread ID is required");
    }
    if (!state.website) {
        console.log(`creating website...`);

        const website = await db.insert(websitesTable)
            .values({
                name: "Test Website",
                threadId: config.configurable.thread_id,
            })
            .returning();
        return {
            website: website[0]
        }
    }

    return {};
}

/**
 * Simple test graph for the new brainstorm agent
 * Usage: Load this in LangGraph Studio to test the agent
 */
export const brainstormTestGraph = new StateGraph(BrainstormTestAnnotation)
    .addNode("setupNode", setupNode)
    .addNode("agent", brainstormAgent)
    .addEdge(START, "setupNode")
    .addEdge("setupNode", "agent")
    .addEdge("agent", END)
    .compile(graphParams);

