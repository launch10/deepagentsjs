import type { GraphState } from "@shared/state/graph";

// okay right... not this... update app state in the beginning of create/update graph
// I think honestly we would have fixed this...
export const isFirstMessage = (state: GraphState) => {
    return state.isFirstMessage === true;
};