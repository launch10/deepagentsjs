import { NodeMiddleware } from "@core";
import { type WebsiteGraphState } from "@state";
import { SaveTaskHistoryService } from "@services";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";

export const saveTaskHistoryNode = NodeMiddleware.use(
    async (state: WebsiteGraphState, config?: LangGraphRunnableConfig): Promise<Partial<WebsiteGraphState>> => {
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