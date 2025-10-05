import { type GraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";

class ResetStateNode extends BaseNode<GraphState> {
  async execute(
    state: GraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<GraphState>> {
    return {
      queue: [],
      completedTasks: []
    } as any;
  }
}

// Export as a function for use in the graph
export const resetStateNode = new ResetStateNode().toNodeFunction();