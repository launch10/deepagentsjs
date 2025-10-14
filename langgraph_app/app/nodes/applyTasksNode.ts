import { type WebsiteBuilderGraphState } from "@state";
import { SaveTaskHistoryService } from "@services";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";

/**
 * Node that generates a project name based on the user's request
 */
class SaveTaskHistoryNode extends BaseNode<WebsiteBuilderGraphState> {
    async execute(
        state: WebsiteBuilderGraphState, 
        config?: LangGraphRunnableConfig
    ): Promise<Partial<WebsiteBuilderGraphState>> {
        if (!state.completedTasks) {
            throw new Error("completedTasks are required");
        }

        const historyService = new SaveTaskHistoryService();
        const results = await historyService.execute({ 
            completedTasks: state.completedTasks, 
            pages: state.pages || [], 
            taskHistory: state.taskHistory || [], 
            website: state.website 
        }, config);

        return results;
    }
}

// Export as a function for use in the graph
export const saveTaskHistoryNode = new SaveTaskHistoryNode().toNodeFunction();