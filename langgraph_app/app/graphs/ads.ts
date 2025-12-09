import { StateGraph, END, START } from "@langchain/langgraph";
import { AdsAnnotation } from "@annotation";
import {
  adsAgent,
  createCampaign,
  getBusinessContext,
  prepareRefreshNode,
  resetNode,
  guardrailsNode,
} from "@nodes";
import { type AdsGraphState } from "@state";
import { Ads } from "@types";

const beforeGenerateNode = (state: AdsGraphState): Partial<AdsGraphState> => {
  if (!state.stage) {
    throw new Error("Stage is required");
  }
  const hasStartedStep = state.hasStartedStep || {};
  hasStartedStep[state.stage] = true;
  return { hasStartedStep };
};

export const adsGraph = new StateGraph(AdsAnnotation)
  .addNode("createCampaign", createCampaign)
  .addNode("beforeGenerate", beforeGenerateNode)
  .addNode("getBusinessContext", getBusinessContext)
  .addNode("prepareRefresh", prepareRefreshNode)
  .addNode("adsAgent", adsAgent)
  .addNode("reset", resetNode)

  .addEdge(START, "createCampaign")
  .addConditionalEdges("createCampaign", guardrailsNode, {
    beforeGenerate: "beforeGenerate",
    __end__: END,
  })
  .addEdge("beforeGenerate", "getBusinessContext")
  .addEdge("getBusinessContext", "prepareRefresh")
  .addEdge("prepareRefresh", "adsAgent")
  .addEdge("adsAgent", "reset")
  .addEdge("reset", END);
