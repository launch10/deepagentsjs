import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { 
  brainstormAgent, 
  qaAgent,
  saveAnswersNode,
  nextStepsAgent,
  createBrainstorm,
  detectIntent,
  processQuestionNode,
  skipNode,
  doTheRestNode,
  offTopicNode
} from "@nodes";
import { NodeMiddleware } from "@middleware";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig, Brainstorm } from "@types";
import { BrainstormNextStepsService } from "@services";
import { isUndefined } from "@utils";
import type { IntentType } from "@nodes";

// Every new response, reset the qa state
const resetNode = NodeMiddleware.use(async (state: BrainstormGraphState, config?: LangGraphRunnableConfig): Promise<Partial<BrainstormGraphState>> => {
      return {
            qa: undefined,
      }
})

const loadNextSteps = NodeMiddleware.use(async (state: BrainstormGraphState, config?: LangGraphRunnableConfig): Promise<Partial<BrainstormGraphState>> => {
      const updatedState = await new BrainstormNextStepsService(state).nextSteps();
      return updatedState;
})

const intentRouter = (state: BrainstormGraphState): string => {
      const intent = state.intent as IntentType;
      
      // Map intent to node
      switch (intent) {
        case "attempted_answer":
          return "qaAgent"; // Continue to QA flow
        case "skip":
          return "skipNode";
        case "process_question":
          return "processQuestionNode";
        case "do_the_rest":
          return "doTheRestNode";
        case "off_topic":
          return "brainstormAgent";
        case "finished":
          return "nextStepsAgent";
        default:
          return "qaAgent"; // Fallback
      }
}

const routeAfterQANode = async (state: BrainstormGraphState, config?: LangGraphRunnableConfig): Promise<string> => {
      if (state.qa!.success === true) {
            return "saveAnswers";
      }

      return "brainstormAgent";
}

const routeAfterSaveNode = async (state: BrainstormGraphState, config?: LangGraphRunnableConfig): Promise<string> => {
    console.log("Route after save node");
    const updatedState = await new BrainstormNextStepsService(state).nextSteps();
    const isConversational = Brainstorm.TopicKindMap[updatedState.currentTopic!] === "conversational";

    console.log("Is conversational: ", isConversational);

    if (isConversational) {
        return "brainstormAgent";
    }

    return "nextStepsAgent";
}

export const brainstormGraph = new StateGraph(BrainstormAnnotation)
      .addNode("reset", resetNode)
      .addNode("createBrainstorm", createBrainstorm)
      .addNode("loadNextSteps", loadNextSteps)
      .addNode("detectIntent", detectIntent)
      .addNode("qaAgent", qaAgent)
      .addNode("saveAnswers", saveAnswersNode)
      .addNode("brainstormAgent", brainstormAgent)
      .addNode("nextStepsAgent", nextStepsAgent)
      .addNode("processQuestionNode", processQuestionNode)
      .addNode("skipNode", skipNode)
      .addNode("doTheRestNode", doTheRestNode)

      .addEdge(START, "reset")
      .addEdge("reset", "createBrainstorm")
      .addEdge("createBrainstorm", "loadNextSteps")
      .addEdge("loadNextSteps", "detectIntent")
      
      // Route based on detected intent
      .addConditionalEdges("detectIntent", intentRouter, {
        qaAgent: "qaAgent",
        skipNode: "skipNode",
        processQuestionNode: "processQuestionNode",
        doTheRestNode: "doTheRestNode",
        nextStepsAgent: "nextStepsAgent",
        brainstormAgent: "brainstormAgent"
      })
      
      // QA flow (only for attempted_answer intent)
      .addConditionalEdges("qaAgent", routeAfterQANode, {
        saveAnswers: "saveAnswers",
        brainstormAgent: "brainstormAgent"
      })
      .addConditionalEdges("saveAnswers", routeAfterSaveNode, {
        brainstormAgent: "brainstormAgent",
        nextStepsAgent: "nextStepsAgent"
      })
      
      // Terminal nodes
      .addEdge("brainstormAgent", END)
      .addEdge("processQuestionNode", END)
      .addEdge("skipNode", END)
      .addEdge("doTheRestNode", END)
      .addEdge("nextStepsAgent", END)