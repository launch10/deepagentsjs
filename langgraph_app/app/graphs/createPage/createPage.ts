import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphAnnotation } from "@annotation";
import { pickThemeNode, planPageNode, queueEachComponentNode, assemblePageNode } from "@nodes";
import { createStylesGraph } from "../createStyles";
import { createComponentGraph } from "./createComponent";
import { graphParams } from "@core";

export const createPageGraph = new StateGraph(GraphAnnotation)
  .addNode("pickTheme", pickThemeNode)
  .addNode("createStyles", createStylesGraph as any)
  .addNode("planPage", planPageNode)
  .addNode("createComponentGraph", createComponentGraph as any)
  .addNode("assemblePage", assemblePageNode)

  .addEdge(START, "pickTheme")
  .addEdge("pickTheme", "createStyles")
  .addEdge("createStyles", "planPage")
  .addConditionalEdges("planPage", queueEachComponentNode as any)
  .addEdge("createComponentGraph", "assemblePage")
  .addEdge("assemblePage", END)
  .compile(graphParams)
