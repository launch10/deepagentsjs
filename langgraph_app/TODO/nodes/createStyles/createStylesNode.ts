import { type WebsiteGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@core";
import { CreateStylesService, type CreateStylesOutputType } from "@services";
import { ThemeModel } from "@models";

/**
 * Node that plans the website content
 */
export const createStylesNode = NodeMiddleware.use(
  async (
    state: WebsiteGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    const website = state.website;

    if (!website) {
      throw new Error("No website found");
    }

    const project = state.project;
    if (!project) {
      throw new Error("No project found");
    }

    const themeId = website.themeId;
    const theme = await ThemeModel.find(themeId);

    if (!theme) {
      throw new Error("No theme found");
    }

    const service = new CreateStylesService();
    const output = await service.execute({ theme, websiteId: website.id, projectId: project.id }) as CreateStylesOutputType;
    const completedTasks = output.completedTasks;

    return {
      completedTasks: completedTasks,
    };
  }
);