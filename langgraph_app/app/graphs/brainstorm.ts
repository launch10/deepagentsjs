import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { type BrainstormGraphState } from "@state";
import { graphParams } from "@core";
import { askQuestionNode, brainstormGuardrailNode, addImplicitFirstQuestionNode } from "@nodes";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";

const router = (state: BrainstormGraphState, config: LangGraphRunnableConfig): string => {
    console.log(`Router received state.route: ${state.route}, isValidAnswer: ${state.isValidAnswer}`);
    
    if (!state.route) {
        if (state.isValidAnswer === false) {
            return "askQuestion";
        }
        return "askQuestion";
    }

    if (state.route === "ui_help") {
        console.log(`hello i am routing to UI help!!!`)
        return "uiHelp"
    } else if (state.route === "keep_brainstorming") {
        return "keepBrainstorming"
    } else if (state.route === "proceed_to_page_builder") {
        return "proceedToPageBuilder"
    } else {
        return "askQuestion"
    }
}

const keepBrainstorming = (state: BrainstormGraphState, config: LangGraphRunnableConfig): Partial<BrainstormGraphState> => {
    return {};
}

const uiHelp = (state: BrainstormGraphState, config: LangGraphRunnableConfig): Partial<BrainstormGraphState> => {
    console.log(`hello from ui help node!`)
    return {};
}

export const brainstormGraph = new StateGraph(BrainstormAnnotation)
    .addNode("addImplicitFirstQuestion", addImplicitFirstQuestionNode)
    .addNode("brainstormGuardrail", brainstormGuardrailNode)
    .addNode("uiHelp", uiHelp)
    .addNode("keepBrainstorming", keepBrainstorming)
    .addNode("askQuestion", askQuestionNode)

    .addEdge(START, "addImplicitFirstQuestion")
    .addEdge("addImplicitFirstQuestion", "brainstormGuardrail")
    .addConditionalEdges("brainstormGuardrail", router)
    .addEdge("uiHelp", END)
    .addEdge("keepBrainstorming", END)
    .addEdge("askQuestion", END)
    .compile(graphParams)