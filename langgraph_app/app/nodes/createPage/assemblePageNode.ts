import { type WebsiteGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@core";
import { AssemblePageService, type AssemblePageOutputType } from "@services";
import { PageModel } from "@models";
import { PageTypeEnum } from "@types";

/**
 * Node that assembles the page from the components
 */
export const assemblePageNode = NodeMiddleware.use(
  async (
    state: WebsiteGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
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
      completedTasks: [...(state.completedTasks || []), ...completedTasks],
    };
  }
);