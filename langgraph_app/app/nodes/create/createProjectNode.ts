import { type WebsiteBuilderGraphState } from "@state";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { projectsApi } from "@services";
import { BaseNode } from "@core";
import { WebsiteModel } from "@models";
import { SaveProjectService } from "@services";
import { isString, isNumber } from "@utils";

/**
 * Node that saves the initial project to the backend
 * Extends BaseNode for consistent infrastructure support
 */
class CreateProjectNode extends BaseNode<GraphState> {
  async execute(
    state: GraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<GraphState>> {
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

    return service.execute({
      projectName: state.projectName,
      jwt: state.jwt,
      accountId: state.accountId,
    }, config)
  }
}

// Export as a function for use in the graph
export const createProjectNode = new CreateProjectNode().toNodeFunction();