import { type GraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { CreateStylesService, type CreateStylesOutputType } from "@services";
import { ThemeModel } from "@models";

/**
 * Node that plans the website content
 * Extends BaseNode for consistent infrastructure support
 */
class CreateStylesNode extends BaseNode<GraphState> {
  async execute(
    state: GraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<GraphState>> {
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
}

// Export as a function for use in the graph
export const createStylesNode = new CreateStylesNode().toNodeFunction();