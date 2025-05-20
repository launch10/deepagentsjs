import { type GraphState } from "@shared/state/graph";
import { getLlm, LLMSkill } from "@langgraph/llm";
import { type Prompt } from "@prompts/core/prompt";
import { 
  codeTaskResultSchema, 
  type CodeTaskResult,
  TaskStatus,
  CodeTaskAction,
  type CodeTask
} from "@models/codeTask";
import { v4 as uuidv4 } from "uuid";

// Actions are shared status update logic (e.g. after a task is completed, how to mark it as completed)
export const completeCodeTask = (state: GraphState, results: CodeTaskResult): CodeTask => {
  const task = state.task;
  task.id ||= uuidv4();
  task.results = results;
  task.action = CodeTaskAction.UPDATE;
  task.status = TaskStatus.COMPLETED;
  task.success = true;
  return task;
}

export const executeCodePrompt = async(prompt: Prompt, state: GraphState): Promise<CodeTaskResult> => {
  const promptString = await prompt(state);
  const llm = getLlm(LLMSkill.Coding);
  const planner = llm.withStructuredOutput(codeTaskResultSchema);
  return await planner.invoke(promptString) as CodeTaskResult;
}