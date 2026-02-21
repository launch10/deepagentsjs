import { StateGraph, END, START } from "@langchain/langgraph";
import { AdsAnnotation } from "@annotation";
import {
  adsAgent,
  createCampaign,
  getBusinessContext,
  handleIntentNode,
  prepareRefreshNode,
  resetNode,
  guardrailsNode,
} from "@nodes";
import { type AdsGraphState } from "@state";
import { NodeMiddleware } from "@middleware";
import type { Ads, LangGraphRunnableConfig } from "@types";
import { withCreditExhaustion } from "./shared";

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

/**
 * Ads graph for generating Google Ads campaigns.
 *
 * Credit exhaustion is detected via withCreditExhaustion wrapper,
 * which runs this graph as a subgraph, then calculates credit status.
 */
export const adsGraph = withCreditExhaustion(
  new StateGraph(AdsAnnotation)
    .addNode("handleIntent", handleIntentNode)
    .addNode("createCampaign", createCampaign)
    .addNode("beforeGenerate", beforeGenerateNode)
    .addNode("getBusinessContext", getBusinessContext)
    .addNode("prepareRefresh", prepareRefreshNode)
    .addNode("adsAgent", adsAgent)
    .addNode("reset", resetNode)

    .addEdge(START, "handleIntent")
    .addEdge("handleIntent", "createCampaign")
    .addConditionalEdges("createCampaign", guardrailsNode, {
      beforeGenerate: "beforeGenerate",
      end: END,
    })
    .addEdge("beforeGenerate", "getBusinessContext")
    .addEdge("getBusinessContext", "prepareRefresh")
    .addEdge("prepareRefresh", "adsAgent")
    // Compaction now happens inside adsAgent via Conversation.start()
    .addEdge("adsAgent", "reset")
    .addEdge("reset", END),
  AdsAnnotation
);
