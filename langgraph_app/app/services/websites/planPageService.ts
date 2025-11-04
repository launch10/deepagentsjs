import { AIMessage } from "@langchain/core/messages";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import type { BaseMessage } from '@langchain/core/messages';
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM, withInfrastructure, type NotificationOptions } from "@core";
import { 
    type CodeTaskType, 
    type PrimaryKeyType, 
    type ComponentOverviewType, 
    type PagePlanType,
    Website, 
    Task,
    type ComponentOverviewPromptType,
    type BackgroundColorEnum,
    type ComponentTypeEnum,
    PageTypeEnum,
 } from "@types";
import { ThemeModel, WebsiteModel, ContentStrategyModel } from "@models";
import { planPagePrompt, type PlanPagePromptProps } from "@prompts";
import { schemaWithoutForeignKeys } from "@utils";
import { SavePageService } from "@services";
import { FileSpecificationModel } from "@models";
import { detect } from "@utils";
import { assert } from "@core";

export { type PlanPagePromptProps }

const notificationContext: NotificationOptions = {
    taskName: `Planning overall landing page`,
    taskType: Task.TypeEnum.CodeTask,
};

export type PlanPageProps = PlanPagePromptProps & {
    websiteId: PrimaryKeyType;
    userRequest: BaseMessage;
}

export type PlanPageOutputType = {
  codeTasks: CodeTaskType[];
  componentOverviews: ComponentOverviewType[];
}

const addLayouts = async (pagePlan: PagePlanType) => {
    if (pagePlan.pageType !== PageTypeEnum.IndexPage) {
        return pagePlan; // TODO: Figure out what to do in this case
    }

    const fileSpecs = await FileSpecificationModel.where({ componentType: ["Nav", "Footer"] })
    const existingNav = detect(pagePlan.components, (component: ComponentOverviewPromptType) => component.componentType === "Nav");
    const existingFooter = detect(pagePlan.components, (component: ComponentOverviewPromptType) => component.componentType === "Footer");
    const layoutComponents = fileSpecs.map(spec => ({
        name: spec.componentType,
        purpose: "Provide navigation",
        context: "Core navigation element",
        componentType: spec.componentType,
        backgroundColor: "primary",
    } as ComponentOverviewPromptType));
    const newNav = detect(layoutComponents, (component: ComponentOverviewPromptType) => component.componentType === "Nav");
    const newFooter = detect(layoutComponents, (component: ComponentOverviewPromptType) => component.componentType === "Footer");
    const nav = existingNav || newNav;
    const footer = existingFooter || newFooter;
    const otherComponents = pagePlan.components.filter(component => component.componentType !== "Nav" && component.componentType !== "Footer");

    pagePlan.components = [nav, ...otherComponents, footer]; // Order will be captured in SavePageService
    return pagePlan;
}
export class PlanPageService {
    @withInfrastructure({
        cache: {
            prefix: "planPage",
        },
        notifications: notificationContext,
    })
    async execute(input: PlanPageProps, config?: LangGraphRunnableConfig): Promise<PlanPageOutputType> {
        const website = await WebsiteModel.find(input.websiteId);
        if (!website) {
            throw new Error(`Website not found for id: ${input.websiteId}`);
        }
        const contentStrategy = await ContentStrategyModel.findBy({websiteId: website.id});
        if (!contentStrategy) {
            throw new Error(`Content strategy not found for website id: ${website.id}`);
        }
        const theme = await ThemeModel.findBy({id: website.themeId});
        if (!theme) {
            throw new Error(`Theme not found for website id: ${website.id}`);
        }
        const userRequest = input.userRequest;
        if (!userRequest) {
            throw new Error("No user request found");
        }

        const promptInput = {
            userRequest,
            contentStrategy,
            theme,
        }

        const schema = Website.Page.pagePlanPromptSchema;
        const llm = getLLM("planning");
        const prompt = await planPagePrompt(promptInput);
        const output = await llm.invoke(prompt) as AIMessage;
        const parser = StructuredOutputParser.fromZodSchema(schemaWithoutForeignKeys(schema));
        let pagePlan = await parser.parse(output.content as string)
        pagePlan = await addLayouts(pagePlan);

        const savedRecords = await new SavePageService().execute({
            website,
            pagePlan
        });

        assert(savedRecords.codeTasks.length === pagePlan.components.length);

        if (!savedRecords.codeTasks) {
            throw new Error("Failed to create code tasks");
        }

        return {
            codeTasks: savedRecords.codeTasks,
            componentOverviews: savedRecords.componentOverviews,
        }
    }
}
