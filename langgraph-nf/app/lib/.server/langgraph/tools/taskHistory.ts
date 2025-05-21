import { tool } from "@langchain/core/tools"; 
import { z } from "zod";
import { type GraphState } from "@shared/state/graph";
import { CodeTaskType, type CompletedCodeTask } from "@models/codeTask"; 
import { type CodeTaskSummary } from "@models/codeTask";
import { type TaskHistoryType, TaskHistory } from "@models/taskHistory"; 

const formatHistory = (pastHistory: CodeTaskSummary[]): string => {
    const history = new TaskHistory(); 
    if (!pastHistory || pastHistory.length === 0) return "No past history recorded.";
    pastHistory.forEach(summary => history.addSummary(summary));
    return history.formatHistory();
};

export function updateTaskHistory(state: GraphState): Partial<GraphState> {
  const completed = state.app.codeTasks?.completedTasks ?? [] as CompletedCodeTask[];
  let history = state.app.codeTasks?.taskHistory;
  if (!history || !(history instanceof TaskHistory)) { 
      history = new TaskHistory(); 
  }

  if (completed.length === 0) {
      return {};
  }

  completed.forEach((taskResult: CompletedCodeTask) => {
      if (taskResult.type && taskResult.filePath && taskResult.instruction) {
          history.addSummary({
              type: taskResult.type,
              filePath: taskResult.filePath,
              instruction: taskResult.instruction,
              summary: taskResult.results?.summary,
          } as CodeTaskSummary);
      } else {
          console.warn("Skipping task summary due to missing fields required for history:", taskResult);
      }
  });

  return {
      app: {
          ...state.app, 
          codeTasks: {
              ...(state.app.codeTasks ?? { queue: [], completedTasks: [], taskHistory: new TaskHistory() }),
              taskHistory: history, 
              completedTasks: [],   
          }
      }
  };
}

export function initializeTools(state: GraphState) { 
  async function getTaskHistory(opts: { 
    filePath?: string;
    taskType?: CodeTaskType;
    limit?: number;
    format?: boolean;
  } = { limit: 10, format: true }): Promise<string | CodeTaskSummary[]> {
    const { filePath, taskType, limit = 10, format = true } = opts;

    let taskHistory: CodeTaskSummary[] = [];
    const currentHistory = state.app.codeTasks?.taskHistory;

    if (currentHistory) {
        if (filePath && taskType) {
            taskHistory = currentHistory.byFile[filePath]?.[taskType] ?? [];
        } else {
            taskHistory = currentHistory.edits ?? [];
        }
    } else {
        taskHistory = [];
    }

    if (taskType) {
      taskHistory = taskHistory.filter(task => task.type === taskType);
    }

    const slicedHistory = taskHistory.slice(-limit);

    return format
      ? formatHistory(slicedHistory)
      : slicedHistory;
  }

  return {
    getTaskHistory,
    getTaskHistoryTool: tool(getTaskHistory, {
        name: "get_task_history", 
        description: "Retrieves the history of completed code tasks. Can filter by file path and task type, limit results, and return formatted string or raw data.",
        schema: z.object({ 
            filePath: z.string().optional().describe("Optional file path to filter history by."),
            taskType: z.nativeEnum(CodeTaskType).optional().describe("Optional task type to filter history by."),
            limit: z.number().int().positive().optional().default(10).describe("Optional limit on the number of most recent results."),
            format: z.boolean().optional().default(true).describe("Return formatted string (true) or raw TaskSummary array (false)."),
        }),
    })
  };
}