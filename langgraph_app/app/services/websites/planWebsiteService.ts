import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLlm, LLMSkill, defaultCachePolicy, withInfrastructure, type NotificationOptions } from "@core";
import { Website, Task } from "@types";
import { planWebsitePrompt, type PlanWebsitePromptProps } from "@prompts";
import { ContentStrategyModel, WebsiteModel } from "@models";
import { withStructuredResponse } from "@utils";
import type { PrimaryKeyType } from "@types";

const notificationContext: NotificationOptions = {
    taskName: "Planning website",
    taskType: Task.TypeEnum.CodeTask,
};

export type PlanWebsiteProps = PlanWebsitePromptProps & {
    websiteId: PrimaryKeyType;
}

export type PlanWebsiteOutputType = {
    contentStrategy: Website.Plan.ContentStrategyType
}

export class PlanWebsiteService {
    @withInfrastructure({
        cache: {
            prefix: "planWebsite",
            ...defaultCachePolicy
        },
        notifications: notificationContext,
    })
    async execute(input: PlanWebsiteProps, config?: LangGraphRunnableConfig): Promise<PlanWebsiteOutputType> {
        const website = await WebsiteModel.find(input.websiteId);
        if (!website) {
            throw new Error("Website not found")
        }
        const schema = Website.Plan.contentStrategySchema;
        const llm = getLlm(LLMSkill.Writing);

        const prompt = await planWebsitePrompt(input);
        const contentStrategy = await withStructuredResponse({ llm, prompt, schema });

        await ContentStrategyModel.create({ ...contentStrategy, websiteId: website.id })

        return { contentStrategy }
    }
}