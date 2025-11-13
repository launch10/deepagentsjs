import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { 
  brainstormAgent, 
  qaAgent,
  saveAnswersNode,
  nextStepsAgent,
  createBrainstorm 
} from "@nodes";
import { NodeMiddleware } from "@middleware";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig, Brainstorm } from "@types";
import { BrainstormNextStepsService } from "@services";
import { isUndefined } from "@utils";

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

const routerNode = (state: BrainstormGraphState, config?: LangGraphRunnableConfig): string => {
      if (!state.currentTopic || state.currentTopic === "lookAndFeel") return "nextStepsAgent";
      if (isUndefined(state.qa)) return "qaAgent";

      if (Brainstorm.TopicKindMap[state.currentTopic] === "conversational") {
            return "brainstormAgent";
      }
      return "nextStepsAgent";
}

const routeAfterQANode = async (state: BrainstormGraphState, config?: LangGraphRunnableConfig): Promise<string> => {
      if (state.qa!.success === true) {
            return "saveAnswers";
      }

      return "brainstormAgent";
}

export const brainstormGraph = new StateGraph(BrainstormAnnotation)
      .addNode("reset", resetNode)
      .addNode("createBrainstorm", createBrainstorm)
      .addNode("loadNextSteps", loadNextSteps)
      .addNode("qaAgent", qaAgent)
      .addNode("saveAnswers", saveAnswersNode)
      .addNode("brainstormAgent", brainstormAgent)
      .addNode("nextStepsAgent", nextStepsAgent)

      .addEdge(START, "reset")
      .addEdge("reset", "createBrainstorm")
      .addEdge("createBrainstorm", "loadNextSteps")
      .addConditionalEdges("loadNextSteps", routerNode, {
        qaAgent: "qaAgent",
        brainstormAgent: "brainstormAgent",
        nextStepsAgent: "nextStepsAgent"
      })
      .addConditionalEdges("qaAgent", routeAfterQANode, {
        saveAnswers: "saveAnswers",
        brainstormAgent: "brainstormAgent"
      })
      .addEdge("saveAnswers", "loadNextSteps")
      .addEdge("brainstormAgent", END)
      .addEdge("nextStepsAgent", END)