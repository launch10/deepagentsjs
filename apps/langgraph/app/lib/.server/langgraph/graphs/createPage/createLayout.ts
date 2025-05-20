import { StateGraph, Send, START, END } from "@langchain/langgraph";
import { GraphAnnotation } from "@state/graph";
import { type GraphState } from "@shared/state/graph";
import { fileSpecRegistry } from "@models/registry/fileSpecificationRegistry";
import { LayoutTypeEnum } from "@models/enums";
import { type CodeTask, CodeTaskType, TaskStatus } from "@models/codeTask";
import { v4 as uuidv4 } from "uuid"
import { FileSpecification } from "@models/fileSpecification";
import { createLayoutNode } from "@nodes/createPage/createLayout";

const queueEachSection = (state: GraphState): Send[] => {
    const layoutSpecs = fileSpecRegistry.getLayout();
    const desiredLayoutSpecs = [LayoutTypeEnum.Nav, LayoutTypeEnum.Footer];
    const specs = layoutSpecs.filter(spec => desiredLayoutSpecs.includes(spec.subtype)) as FileSpecification[];
    const tasks: CodeTask[] = specs.map((spec) => {
        return {
            id: uuidv4(), 
            type: CodeTaskType.CREATE_SECTION,
            status: TaskStatus.PENDING,
            fileSpec: spec,
            filePath: spec.canonicalPath,
            instruction: "Create this section",
        }
    });

    return tasks.map(task => new Send("createLayout", { 
        ...state,
        task,
    }));
}

export const createLayoutGraph = new StateGraph(GraphAnnotation)
    .addNode("createLayout", createLayoutNode)
    .addConditionalEdges(START, queueEachSection)
    .addEdge("createLayout", END);

export const graph = createLayoutGraph.compile(); 