import { StateGraph, END, START } from "@langchain/langgraph";
import { AdsAnnotation } from "@annotation";
import { adsAgent } from "@nodes";

/**
 * The main ads graph
 */
export const adsGraph = new StateGraph(AdsAnnotation)
      .addNode("agent", adsAgent)

      .addEdge(START, "agent")
      .addEdge("agent", END)