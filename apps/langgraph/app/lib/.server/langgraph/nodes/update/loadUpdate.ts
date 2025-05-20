import { type GraphState } from "@shared/state/graph";
import { Project } from "@langgraph/models/project";
import { type ProjectData } from "@models/project";
import { loadShared } from "@nodes/core";
import { baseNode } from "@nodes/core/templates/base";

async function loadUpdate(state: GraphState): Promise<Partial<GraphState>> {
    if (!state.app.files || Object.keys(state.app.files).length === 0) {
        let project = Project.create({ projectName: state.projectName });
        state.app.files = await project.getFiles();
    }
    return loadShared(state);
}

export const loadUpdateNode = baseNode({
    nodeName: "loadUpdateNode",
    nodeFn: loadUpdate
});
