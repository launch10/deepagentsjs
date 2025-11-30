import { StateGraph, END, START } from "@langchain/langgraph";
import { AdsAnnotation } from "@annotation";
import { adsAgent, getBusinessContext, prepareRefreshNode, resetNode } from "@nodes";

export const adsGraph = new StateGraph(AdsAnnotation)
      .addNode("getBusinessContext", getBusinessContext)
      .addNode("prepareRefresh", prepareRefreshNode)
      .addNode("agent", adsAgent)
      .addNode("reset", resetNode)

      .addEdge(START, "getBusinessContext")
      .addEdge("getBusinessContext", "prepareRefresh")
      .addEdge("prepareRefresh", "agent")
      .addEdge("agent", "reset")
      .addEdge("reset", END)