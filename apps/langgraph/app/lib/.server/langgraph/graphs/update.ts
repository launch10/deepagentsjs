import { START, END, Send, StateGraph } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { GraphAnnotation } from "@state/graph";
import { type GraphState } from "@shared/state/graph";
import { createPageGraph, createSectionGraph } from "@graphs/createPage";
import { CodeTaskType } from "@models/codeTask";
import { loadUpdateNode, backupProjectNode, buildTasksAgent, updateCodeAgent } from "@nodes/update";
import { applyUpdatesNode, saveNode } from "@nodes/core"
import { ConfigurationAnnotation } from "@state/configuration";

const queueTasks = async(state: GraphState) => {
    if (!state.app?.codeTasks || !state.app.codeTasks.queue) {
        return [];
    }
    const queue = state.app.codeTasks.queue;
    return queue.map(task => {
        if (task.type === CodeTaskType.CREATE_PAGE) {
            return new Send("createPageGraph", {
                ...state,
                task,
            });
        }
        if (task.type === CodeTaskType.CREATE_SECTION) {
            return new Send("createSectionGraph", {
                ...state,
                task,
            });
        }
        if (task.type === CodeTaskType.UPDATE) {
            return new Send("updateCodeAgent", {
                ...state,
                task,
            });
        }
    });
}

const waitForUpdates = async(state: GraphState) => {
    // await all nodes
    return state;
}

export const updateGraph = new StateGraph(GraphAnnotation, ConfigurationAnnotation)
    .addNode("startUpdate", loadUpdateNode)
    .addNode("backupProject", backupProjectNode)
    .addNode("buildTasks", buildTasksAgent)
    .addNode("updateCodeAgent", updateCodeAgent)
    .addNode("createPageGraph", createPageGraph)
    .addNode("createSectionGraph", createSectionGraph)
    .addNode("waitForUpdates", waitForUpdates)
    .addNode("applyUpdates", applyUpdatesNode)
    .addNode("saveNode", saveNode)

    .addEdge(START, "backupProject")
    .addEdge("backupProject", "startUpdate")
    .addEdge("startUpdate", "buildTasks")
    .addConditionalEdges("buildTasks", queueTasks)
    .addEdge("updateCodeAgent", "waitForUpdates")
    .addEdge("createPageGraph", "waitForUpdates")
    .addEdge("createSectionGraph", "waitForUpdates")
    .addEdge("waitForUpdates", "applyUpdates")
    .addEdge("applyUpdates", "saveNode")
    .addEdge("saveNode", END);

// export const checkpointer = PostgresSaver.fromConnString(process.env.POSTGRES_URI!);
// await checkpointer.setup();

//   interruptBefore: [], // Options!
//   interruptAfter: [],
// export const graph = updateGraph.compile({ checkpointer });
export const graph = updateGraph.compile();
