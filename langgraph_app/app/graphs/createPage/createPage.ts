import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphAnnotation } from "@annotation";
import { pickThemeNode, planPageNode, saveTaskHistoryNode, queueEachComponentNode, assemblePageNode } from "@nodes";
import { createStylesGraph } from "../createStyles";
import { createComponentGraph } from "./createComponent";
// import { assemblePageNode, queuePageNode } from "@nodes/createPage";
// import { graph as createSectionGraph } from "@graphs/createPage/createSection";
// import { graph as createLayoutGraph } from "@graphs/createPage/createLayout";
// import { graph as createStylesGraph } from "@graphs/createPage/createStyles";
// import { setupNode } from "@nodes/createPage/setup";
// import { graphParams } from "@graphs/params";
// import { cachePolicy } from "@nodes/core/templates/base";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { graphParams } from "@core";

export const createPageGraph = new StateGraph(GraphAnnotation)
  .addNode("pickTheme", pickThemeNode)
  .addNode("createStyles", createStylesGraph)
  .addNode("planPage", planPageNode)
  .addNode("createComponentGraph", createComponentGraph)
  .addNode("saveTaskHistory", saveTaskHistoryNode)
  .addNode("assemblePage", assemblePageNode)
//     .addNode("createLayoutGraph", createLayoutGraph)
//     .addNode("queuePage", queuePageNode)
//     .addNode("assemblePage", assemblePageNode, { cachePolicy })

  .addEdge(START, "pickTheme")
  .addEdge("pickTheme", "createStyles")
  .addEdge("createStyles", "planPage")
  .addConditionalEdges("planPage", queueEachComponentNode)
  .addEdge("createComponentGraph", "saveTaskHistory")
  .addEdge("saveTaskHistory", "assemblePage")
  .addEdge("assemblePage", END)
  .compile(graphParams)

//     .addEdge(START, "startCreatePage")
//     .addEdge("startCreatePage", "createStyles")
//     .addEdge("createStyles", "planPage")
//     .addEdge("createSectionGraph", "waitForAllSections")
//     .addEdge("waitForAllSections", "createLayoutGraph")
//     .addEdge("createLayoutGraph", "queuePage")
//     .addEdge("queuePage", "assemblePage")
//     .addEdge("assemblePage", END);