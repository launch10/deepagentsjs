import { StateGraph, Send, START, END } from "@langchain/langgraph";
import { GraphAnnotation } from "@state/graph";
import { type GraphState } from "@shared/state/graph";
import { planPageNode } from "@nodes/createPage";
import { assemblePageNode, queuePageNode } from "@nodes/createPage";
import { graph as createSectionGraph } from "@graphs/createPage/createSection";
import { graph as createLayoutGraph } from "@graphs/createPage/createLayout";
import { graph as createStylesGraph } from "@graphs/createPage/createStyles";
import { setupNode } from "@nodes/createPage/setup";
import { graphParams } from "@graphs/params";

const queueEachSection = (state: GraphState): Send[] => {
    const queue = state.app.codeTasks?.queue ?? [];
    return queue.map(task => new Send("createSectionGraph", { 
        ...state,
        task,
    }));
}

const waitForAllSections = (state: GraphState): GraphState => {
    const sections = state.app.codeTasks?.completedTasks
                          .filter((task) => task.type == "CREATE_SECTION")
                          .map((task) => {
                            return {
                                ...task.section,
                                file: {
                                    path: task.results.filePath,
                                    content: task.results.code,
                                    page: state.app.page,
                                }
                            }
                          });
    return {
        ...state,
        app: { 
            ...state.app,
            project: {
                ...state.app.project,
                pages: [
                    ...(state.app.project?.pages || []),
                    {
                        ...state.app.page,
                        sections: sections,
                    }
                ]
            }
        }
    }
}

export const createGraph = new StateGraph(GraphAnnotation)
    .addNode("startCreatePage", setupNode)
    .addNode("createStyles", createStylesGraph)
    .addNode("planPage", planPageNode, {
        cachePolicy: { ttl: 60 * 60 * 24 } // 24 hours
    })
    .addNode("createSectionGraph", createSectionGraph)
    .addNode("waitForAllSections", waitForAllSections)
    .addNode("createLayoutGraph", createLayoutGraph)
    .addNode("queuePage", queuePageNode)
    .addNode("assemblePage", assemblePageNode, { 
        cachePolicy: { ttl: 60 * 60 * 24 } // 24 hours
    })

    .addEdge(START, "startCreatePage")
    .addEdge("startCreatePage", "createStyles")
    .addEdge("createStyles", "planPage")
    .addConditionalEdges("planPage", queueEachSection)
    .addEdge("createSectionGraph", "waitForAllSections")
    .addEdge("waitForAllSections", "createLayoutGraph")
    .addEdge("createLayoutGraph", "queuePage")
    .addEdge("queuePage", "assemblePage")
    .addEdge("assemblePage", END);

export const graph = createGraph.compile(graphParams);