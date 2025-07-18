import { type GraphState } from "@shared/state/graph";

export type Prompt = (state: GraphState) => Promise<string>;