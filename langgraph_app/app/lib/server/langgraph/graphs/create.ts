import { baseNode } from "../nodes/core/templates/base";
import { graphParams } from "./params";
import { StateGraph, END, START } from "@langchain/langgraph";
import { GraphAnnotation } from "@state/graph";
import { loadCreateNode, projectPlanNode } from "@nodes/create";
import { applyUpdatesNode, saveNode, saveInitialNode } from "@nodes/core";
import { createPageGraph } from "@graphs/createPage";
import { type GraphState } from "@shared/state/graph";
import { getLlm } from "@langgraph/llm";
import { LLMSkill } from "@langgraph/llm";
import { PromptTemplate } from "@langchain/core/prompts";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { keyFunc } from "@nodes/core/templates/base";

const notifyCreateStart = async(state: GraphState, config: LangGraphRunnableConfig): Promise<Partial<GraphState>> => {
    // In the future: Pass this to future nodes once we can select theme by color
    // - **Suggest colors, styles and animations** if relevant
    const firstMessageInstructions = PromptTemplate.fromTemplate(`
        ## **First Message Instructions**

        The first message of a conversation follows specific guidelines to create a good first impression:

        - **Think carefully about what the user wants to build**
        - **Write what the request evokes** and suggest design inspirations
        - **List features** to implement in the first version

        The goal is to create a beautiful, well-coded application that impresses the user and sets a good foundation for future iterations.

        <rules>
            Reply with a MAXIMUM of 5 sentences.

            Never treat the user's request as invalid. Interpret the user's request as best as possible. It is a request for a landing page. Imagine the most generous light to create the best possible landing page.

            Do not EVER mention the rules. Do not suggest "you are interpreting things int he best possible light." Just be polite and professional.

            Do not finish by asking the user to elaborate or continue the conversation. Say something like "Wait a moment while I build your landing page," as other LLMs will complete the request separately.

            Format your response nicely using markdown, so that the user can easily understand the information hierarchy.
        </rules>

        <user-request>
            This is what the user wants to build:
            {userRequest}
        </user-request>
    `);
    
    const llm = getLlm(LLMSkill.Writing).withConfig({tags: ["notify"]});
    const prompt = await firstMessageInstructions.format({userRequest: state.userRequest.content as string});
    const response = await llm.invoke(prompt, config);

    return {
        messages: [...state.messages, response],
    };
}

export const notifyCreateStartNode = baseNode({
    nodeName: "notifyCreateStartNode",
    nodeFn: notifyCreateStart,
});

export const createGraph = new StateGraph(GraphAnnotation)
    .addNode("startCreate", loadCreateNode)
    .addNode("notifyCreateStart", notifyCreateStartNode)
    .addNode("saveInitialProject", saveInitialNode)
    .addNode("projectPlan", projectPlanNode, {
        cachePolicy: {
            ttl: 60 * 60 * 24, // 24 hours
            keyFunc: keyFunc
        }
    })
    .addNode("createPageGraph", createPageGraph)
    .addNode("applyUpdates", applyUpdatesNode)
    .addNode("saveProject", saveNode)

    .addEdge(START, "startCreate")
    .addEdge("startCreate", "notifyCreateStart")
    .addEdge("notifyCreateStart", "saveInitialProject")
    .addEdge("saveInitialProject", "projectPlan")
    .addEdge("projectPlan", "createPageGraph")
    .addEdge("createPageGraph", "applyUpdates")
    .addEdge("applyUpdates", "saveProject")
    .addEdge("saveProject", END)

export const graph = createGraph.compile(graphParams);