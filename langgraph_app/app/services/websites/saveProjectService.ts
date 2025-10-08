import { type ProjectType, type WebsiteType } from "@types";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { projectsApi } from "@services";
import { ProjectModel, WebsiteModel } from "@models";
import { isUndefined } from "@utils";

export type CreateProjectOutputType = {
  project: ProjectType;
  website: WebsiteType;
}

export type CreateProjectProps = {
  projectName: string;
  jwt: string;
  accountId: number;
}

export class SaveProjectService {
    async execute(input: CreateProjectProps, config?: LangGraphRunnableConfig): Promise<CreateProjectOutputType> {
      const apiResponse = await projectsApi.createProject({
        name: input.projectName,
        threadId: config?.configurable?.thread_id,
        accountId: input.accountId,
      }, input.jwt);

      if (!apiResponse.success) {
        throw new Error("Failed to create project");
      }

      const project = await ProjectModel.find(apiResponse.data.id);
      const website = await WebsiteModel.find(apiResponse.data.websiteId);

      if (isUndefined(project) || isUndefined(website)) {
        throw new Error("Failed to create website");
      }

      return {
        project,
        website
      }
    }
}