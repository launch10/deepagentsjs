import { StateGraph, END, START } from "@langchain/langgraph";
import { BrainstormAnnotation } from "@annotation";
import { brainstormAgent } from "@nodes";
import { createBrainstorm } from "@nodes";
import { NodeMiddleware } from "@middleware";
import { type BrainstormGraphState } from "@state";
import { type LangGraphRunnableConfig, Brainstorm } from "@types";
import { BrainstormNextStepsService } from "@services";

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
      if (!state.currentTopic) return "nextStepsAgent";
      if (state.qa?.success) return "brainstormAgent";
      if (Brainstorm.TopicKindMap[state.currentTopic] === "conversational") return "qaAgent";

      return "nextStepsAgent";
}

const routeAfterQANode = (state: BrainstormGraphState, config?: LangGraphRunnableConfig): string => {
      if (state.qa!.success) return "saveAnswers";
      return "brainstormAgent";
}

// Check if answer is good or not.
const qaAgent = () => {
      // Include criteria for success
      // Lookup based on question type
}

// Continue talking with user until they give a good answer.
const brainstormAgent = () => {
      // Include ideas for next question
}

const saveAnswers = () => {

}

/**
 * Simple test graph for the new brainstorm agent
 * Usage: Load this in LangGraph Studio to test the agent
 */
export const brainstormGraph = new StateGraph(BrainstormAnnotation)
      .addNode("reset", resetNode)
      .addNode("createBrainstorm", createBrainstorm)
      .addNode("loadNextSteps", loadNextSteps)
      .addNode("qaAgent", qaAgent) // goes to save or ask question
      .addNode("saveAnswers", saveAnswers)
      .addNode("brainstormAgent", brainstormAgent)
      .addNode("nextStepsAgent", nextStepsAgent)

      .addEdge(START, "createBrainstorm")
      .addEdge("createBrainstorm", "loadNextSteps")
      .addConditionalEdges("loadNextSteps", routerNode) // QA, continue brainstorming, or next steps
      .addConditionalEdges("qaAgent", routeAfterQANode) // Save OR continue brainstorming (ask clarification)
      .addEdge("saveAnswers", router) // Continue brainstorming OR next steps
      .addEdge("brainstormAgent", END)
      .addEdge("nextStepsAgent", END)