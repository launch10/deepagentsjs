import { START, END, Send, StateGraph } from "@langchain/langgraph";
import { GraphAnnotation } from "@annotation";
import { type WebsiteGraphState } from "@state";
import { graphParams } from "@core";
// import { createPageGraph, createSectionGraph } from "@graphs/createPage";
// import { CodeTaskType } from "@models/codeTask";
// import { loadUpdateNode, backupProjectNode, buildTasksAgent, updateCodeAgent } from "@nodes/update";
import { buildTasksAgent, resetStateNode } from "@nodes";
// import { applyUpdatesNode, saveNode } from "@nodes/core"
// import { ConfigurationAnnotation } from "@state/configuration";
// import { graphParams } from "@graphs/params";
// import { cachePolicy } from "@nodes/core/templates/base";

// const queueTasks = async(state: GraphState) => {
//     if (!state.app?.codeTasks || !state.app.codeTasks.queue) {
//         return [];
//     }
//     const queue = state.app.codeTasks.queue;
//     return queue.map(task => {
//         if (task.type === CodeTaskType.CREATE_PAGE) {
//             return new Send("createPageGraph", {
//                 ...state,
//                 task,
//             });
//         }
//         if (task.type === CodeTaskType.CREATE_SECTION) {
//             return new Send("createSectionGraph", {
//                 ...state,
//                 task,
//             });
//         }
//         if (task.type === CodeTaskType.UPDATE) {
//             return new Send("updateCodeAgent", {
//                 ...state,
//                 task,
//             });
//         }
//     });
// }

// const waitForUpdates = async(state: WebsiteGraphState) => {
//     return state;
// }

export const updateGraph = new StateGraph(GraphAnnotation)
    .addNode("resetState", resetStateNode)
    .addNode("buildTasks", buildTasksAgent)
    // .addNode("updateCodeAgent", updateCodeAgent, { cachePolicy })
    // .addNode("createPageGraph", createPageGraph)
    // .addNode("createSectionGraph", createSectionGraph)
    // .addNode("waitForUpdates", waitForUpdates)
    // .addNode("applyUpdates", applyUpdatesNode)
    // .addNode("saveNode", saveNode)

    .addEdge(START, "resetState")
    .addEdge("resetState", "buildTasks")
    .addEdge("buildTasks", END)
    .compile(graphParams)
    // .addEdge(START, "backupProject")
    // .addEdge("backupProject", "startUpdate")
    // .addEdge("startUpdate", "buildTasks")
    // .addConditionalEdges("buildTasks", queueTasks)
    // .addEdge("updateCodeAgent", "waitForUpdates")
    // .addEdge("createPageGraph", "waitForUpdates")
    // .addEdge("createSectionGraph", "waitForUpdates")
    // .addEdge("waitForUpdates", "applyUpdates")
    // .addEdge("applyUpdates", "saveNode")
    // .addEdge("saveNode", END);