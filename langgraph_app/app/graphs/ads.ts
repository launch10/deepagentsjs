import { StateGraph, END, START } from "@langchain/langgraph";
import { AdsAnnotation } from "@annotation";
import { adsAgent, getBusinessContext, prepareRefreshNode, resetNode, guardrailsNode } from "@nodes";

export const adsGraph = new StateGraph(AdsAnnotation)
      .addNode("getBusinessContext", getBusinessContext)
      .addNode("prepareRefresh", prepareRefreshNode)
      .addNode("adsAgent", adsAgent)
      .addNode("reset", resetNode)

      .addConditionalEdges(START, guardrailsNode, {
            "getBusinessContext": "getBusinessContext",
            "__end__": END
      })
      .addEdge("getBusinessContext", "prepareRefresh")
      .addEdge("prepareRefresh", "adsAgent")
      .addEdge("adsAgent", "reset")
      .addEdge("reset", END)