import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { type BrainstormGraphState } from "@state";
import { graphParams } from "@core";
import { askQuestionNode, guardrailNode, setupNode, uiHelpNode, keepBrainstormingNode } from "@nodes";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { getLlm, LLMSkill, LLMSpeed } from "@core";
import { isHumanMessage, isAIMessage, Brainstorm } from "@types";

const router = (state: BrainstormGraphState, config: LangGraphRunnableConfig): string => {
    console.log(`Router received state.route: ${state.route}, isValidAnswer: ${state.isValidAnswer}`);
    
    if (!state.route) {
        if (state.isValidAnswer === false) {
            return "askQuestion";
        }
        return "askQuestion";
    }

    if (Brainstorm.isRoute(state.route)) {
        return state.route;
    }

    return "askQuestion"
}

const seekApproval = (state: BrainstormGraphState, config: LangGraphRunnableConfig): Partial<BrainstormGraphState> => {
    return {
        availableActions: ["FINISHED"]
    }
}

export const brainstormGraph = new StateGraph(BrainstormAnnotation)
    .addNode("setup", setupNode)
    .addNode("guardrails", guardrailNode)
    .addNode("uiHelp", uiHelpNode)
    .addNode("keepBrainstorming", keepBrainstormingNode)
    .addNode("seekApproval", seekApproval)
    .addNode("askQuestion", askQuestionNode)

    .addEdge(START, "setup")
    .addEdge("setup", "guardrails")
    .addConditionalEdges("guardrails", router)
    .addEdge("uiHelp", END)
    .addEdge("keepBrainstorming", END)
    .addEdge("askQuestion", END)
    .addEdge("seekApproval", END)
    .compile(graphParams)