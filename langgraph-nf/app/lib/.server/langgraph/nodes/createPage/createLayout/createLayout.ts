import { createLayoutPrompt } from "@prompts/createPage/createLayout";
import { type GraphState } from "@shared/state/graph";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { completeCodeTask, executeCodePrompt } from "@nodes/actions/codeTasks";
import { baseNode } from "@nodes/core/templates/base";
import { type CompletedCodeTask } from "@models/codeTask";

const createLayout = async(state: GraphState, config: LangGraphRunnableConfig): Promise<Partial<GraphState>> => {
  const results = await executeCodePrompt(createLayoutPrompt, state);
  const task = completeCodeTask(state, results);

  return {
    app: {
        codeTasks: {
            completedTasks: [task as CompletedCodeTask],
        }
    }
  }
}

export const createLayoutNode = baseNode({
  nodeName: "createLayoutNode",
  nodeFn: createLayout
})