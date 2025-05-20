import type { GraphState } from "@shared/state/graph";
import { Project } from "@langgraph/models/project"; 
import { baseNode } from "@nodes/core/templates/base";

async function backupProject(state: GraphState): Promise<Partial<GraphState>> {
    const { projectName, app } = state;

    if (!projectName) {
        return { app: { ...app, error: "projectName is missing in state" } };
    }

    const project = Project.create({ projectName });
    project.backup();

    return { 
        app: {
            ...app,
            error: undefined
        }
    };
}

export const backupProjectNode = baseNode({
    nodeName: "backupProject",
    nodeFn: backupProject
});
