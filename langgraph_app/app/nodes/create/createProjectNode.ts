import { NodeMiddleware } from "@core";
import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { projectsApi } from "@services";
import { WebsiteModel } from "@models";
import { SaveProjectService } from "@services";
import { isString, isNumber } from "@utils";

/**
 * Node that saves the initial project to the backend
 */
export const createProjectNode = NodeMiddleware.use(
  async (
    state: WebsiteBuilderGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteBuilderGraphState>> => {
    if (!isString(state.projectName)) {
      throw new Error("Project name is undefined");
    }
    if (!isString(state.jwt)) {
      throw new Error("JWT is undefined");
    } 
    if (!isNumber(state.accountId)) {
      throw new Error("Account ID is undefined");
    }

    const service = new SaveProjectService();

    const result = await service.execute({
      projectName: state.projectName,
      jwt: state.jwt,
      accountId: state.accountId,
    }, config)

    return result
  }
);