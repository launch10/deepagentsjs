import { type GraphState } from "@shared/state/graph";
import { Template } from "@langgraph/models/template";
import { baseNode } from "@nodes/core/templates/base";
import { loadShared } from "@nodes/core";

export async function loadCreate(state: GraphState): Promise<Partial<GraphState>> {
    if (!state.app.files || Object.keys(state.app.files).length === 0) {
        let template = await Template.getTemplate("default");
        state.app.files = template.files;
    }
    return loadShared(state);
}

export const loadCreateNode = baseNode({
    nodeName: "loadCreateNode",
    nodeFn: loadCreate
});
    