import type { GraphState } from "@shared/state/graph";
import { initializeTools } from "@tools/taskHistory";

export const taskHistory = async (state: GraphState, filePath: string) => {
    const { getTaskHistory } = initializeTools(state);
    const taskHistory = await getTaskHistory({ filePath: filePath, limit: 5 });
    return taskHistory;
}