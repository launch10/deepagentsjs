import { type GraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseNode } from "@core";
import { AssemblePageService, type AssemblePageOutputType } from "@services";
import { PageModel } from "@models";
import { PageTypeEnum } from "@types";

/**
 * Node that assembles the page from the components
 * Extends BaseNode for consistent infrastructure support
 */
class AssemblePageNode extends BaseNode<GraphState> {
  async execute(
    state: GraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<GraphState>> {
    const website = state.website;
    if (!website) {
      throw new Error("No website found");
    }
    const page = await PageModel.findBy({
      websiteId: website.id,
      pageType: PageTypeEnum.IndexPage
    })
    if (!page) {
      throw new Error("No page found");
    }

    const project = state.project;
    if (!project) {
      throw new Error("No project found");
    }

    const service = new AssemblePageService();
    const output = await service.execute({ website, page }) as AssemblePageOutputType;
    const completedTasks = output.completedTasks;

    return {
      completedTasks: [...state.completedTasks, ...completedTasks],
    };
  }
}

// Export as a function for use in the graph
export const assemblePageNode = new AssemblePageNode().toNodeFunction();