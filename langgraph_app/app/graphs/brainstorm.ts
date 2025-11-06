import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { type BrainstormGraphState } from "@state";
import { graphParams } from "@core";
import { askQuestionNode, guardrailNode, setupNode, uiHelpNode, keepBrainstormingNode } from "@nodes";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { Brainstorm } from "@types";

const routeAction = (state: BrainstormGraphState, config: LangGraphRunnableConfig): string => {
    if (Brainstorm.isAction(state.action)) {
        return state.action;
    }

    return "guardrails";
}

const routeGuardrail = (state: BrainstormGraphState, config: LangGraphRunnableConfig): string => {
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
        availableActions: ["finished"]
    }
}

const proceedToPageBuilder = (state: BrainstormGraphState, config: LangGraphRunnableConfig): Partial<BrainstormGraphState> => {
    return {
        redirect: "website_builder"
    }
}

const skip = (state: BrainstormGraphState, config: LangGraphRunnableConfig): Partial<BrainstormGraphState> => {
    return {
        questionIndex: state.questionIndex + 1
    }
}

const helpMeAnswer = (state: BrainstormGraphState, config: LangGraphRunnableConfig): Partial<BrainstormGraphState> => {
    // change this... actually reply (not as user, but as AIMessage), then proceed to AskQuestionNode
    return {
        isValidAnswer: false
    }
}

const doTheRest = (state: BrainstormGraphState, config: LangGraphRunnableConfig): Partial<BrainstormGraphState> => {
    // until ACTIONS == ["FINISHED"]
    // ask next question
    // help me answer node
}

export const brainstormGraph = new StateGraph(BrainstormAnnotation)
    .addNode("setup", setupNode)
    .addNode("guardrails", guardrailNode)
    .addNode("uiHelp", uiHelpNode)
    .addNode("keepBrainstorming", keepBrainstormingNode)
    .addNode("seekApproval", seekApproval)
    .addNode("proceedToPageBuilder", proceedToPageBuilder)
    .addNode("askQuestion", askQuestionNode)

    .addEdge(START, "setup")
    .addConditionalEdges("setup", routeAction)
    .addConditionalEdges("guardrails", routeGuardrail)
    .addEdge("uiHelp", END)
    .addEdge("keepBrainstorming", END)
    .addEdge("askQuestion", END)
    .addEdge("seekApproval", END)
    .addEdge("proceedToPageBuilder", END)
    .compile(graphParams)