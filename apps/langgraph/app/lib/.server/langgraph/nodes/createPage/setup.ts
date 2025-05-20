import { type GraphState } from "@shared/state/graph";
import { baseNode } from "@nodes/core/templates/base";
// import { loadMockGraphState } from "@services/mockDataService"; 

export const setupNode = baseNode({
    nodeName: "setup",
    nodeFn: async (state: GraphState) => {
        // state = loadMockGraphState(state);

        const { page } = state.app;

        if (!page) {
            throw new Error("Page is missing from worker state.");
        }

        return state;
    }
});