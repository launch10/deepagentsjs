import { assemblePagePrompt } from "@prompts/createPage";
import { type GraphState } from "@shared/state/graph";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { completeCodeTask } from "../actions/codeTasks";
import { executeCodePrompt } from "../actions/codeTasks";
import { baseNode } from "@nodes/core/templates/base";
import { type CompletedCodeTask } from "@models/codeTask";

const assemblePage = async(state: GraphState, config: LangGraphRunnableConfig): Promise<Partial<GraphState>> => {
  const results = await executeCodePrompt(assemblePagePrompt, state);
  const task = completeCodeTask(state, results);

  return {
    app: {
        codeTasks: {
            completedTasks: [task as CompletedCodeTask],
        }
    }
  }
}

export const assemblePageNode = baseNode({
  nodeName: "assemblePageNode",
  nodeFn: assemblePage,
});