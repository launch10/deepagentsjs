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
import { NodeMiddleware } from "@middleware";
import type { Ads, LangGraphRunnableConfig } from "@types";

const beforeGenerateNode = NodeMiddleware.use(
  {},
  async (state: AdsGraphState, config: LangGraphRunnableConfig) => {
    if (!state.stage) {
      throw new Error("Stage is required");
    }
    const hasStartedStep = state.hasStartedStep || {};
    hasStartedStep[state.stage] = true;
    return { hasStartedStep };
  }
);

const prepareNode = async (state: AdsGraphState) => {
  return {
    error: null,
  };
};

export const adsGraph = new StateGraph(AdsAnnotation)
  .addNode("prepare", prepareNode)
  .addNode("createCampaign", createCampaign)
  .addNode("beforeGenerate", beforeGenerateNode)
  .addNode("getBusinessContext", getBusinessContext)
  .addNode("prepareRefresh", prepareRefreshNode)
  .addNode("adsAgent", adsAgent)
  .addNode("reset", resetNode)

  .addEdge(START, "prepare")
  .addEdge("prepare", "createCampaign")
  .addConditionalEdges("createCampaign", guardrailsNode, {
    beforeGenerate: "beforeGenerate",
    __end__: END,
  })
  .addEdge("beforeGenerate", "getBusinessContext")
  .addEdge("getBusinessContext", "prepareRefresh")
  .addEdge("prepareRefresh", "adsAgent")
  .addEdge("adsAgent", "reset")
  .addEdge("reset", END);
