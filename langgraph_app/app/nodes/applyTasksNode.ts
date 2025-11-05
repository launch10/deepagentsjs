import { NodeMiddleware } from "@core";
import { type WebsiteBuilderGraphState } from "@state";
import { SaveTaskHistoryService } from "@services";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";

export const saveTaskHistoryNode = NodeMiddleware.use(
    async (state: WebsiteBuilderGraphState, config?: LangGraphRunnableConfig): Promise<Partial<WebsiteBuilderGraphState>> => {
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
);