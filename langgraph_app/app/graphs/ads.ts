import { StateGraph, END, START } from "@langchain/langgraph";
import { AdsAnnotation } from "@annotation";
import { adsAgent, getBusinessContext } from "@nodes";

/**
 * The main ads graph
 */
export const adsGraph = new StateGraph(AdsAnnotation)
      .addNode("getBusinessContext", getBusinessContext)
      .addNode("agent", adsAgent)

      .addEdge(START, "getBusinessContext")
      .addEdge("getBusinessContext", "agent")
      .addEdge("agent", END)