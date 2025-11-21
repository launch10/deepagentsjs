import { keyBy, mapArray } from "@utils";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { 
  type CodeTaskType, 
  type WebsiteType, 
  type ComponentType, 
  type PagePlanType,
  type PageType, 
  type ComponentOverviewType,
  type FileSpecType,
  Task,
  CodeTask,
 } from "@types";
import { CodeTaskModel, ComponentOverviewModel, FileSpecificationModel, PageModel } from "@models";
import { db, componentOverviews as componentOverviewsTable, tasks as tasksTable } from "app/db";

export type CreatePageOutputType = {
    page: PageType,
    componentOverviews: ComponentOverviewType[],
    fileSpecs: FileSpecType[],
    codeTasks: CodeTaskType[],
}

export type CreatePageProps = {
    website: WebsiteType,
    pagePlan: PagePlanType
}

export class SavePageService {
    async execute(input: CreatePageProps, config?: LangGraphRunnableConfig): Promise<CreatePageOutputType> {
        if (!input.pagePlan) {
            throw new Error("Page plan is required");
        }
        if (!input.website) {
            throw new Error("Website is required");
        }
        const pagePlan = input.pagePlan;
        const website = input.website;

        return await db.transaction(async (tx) => {
            const fileSpec = await FileSpecificationModel.findBy({componentType: pagePlan.pageType});

            const page = await PageModel.findOrCreateBy({
                websiteId: website.id,
                pageType: pagePlan.pageType,
                fileSpecificationId: fileSpec.id
            }, {}, tx);

            const componentTypes = mapArray(pagePlan.components, "componentType");
            const fileSpecs = await FileSpecificationModel.where({ componentType: componentTypes }, tx);
            const indexedSpecs = keyBy(fileSpecs, "componentType");

            const componentOverviews = await ComponentOverviewModel.normalizePromptOutput(
                pagePlan.components, 
                page.id, 
                website.id
            );
            
            const createdOverviews = await tx.insert(componentOverviewsTable)
                .values(componentOverviews)
                .onConflictDoNothing()
                .returning();
            const indexedOverviews = keyBy(createdOverviews, "name");
            
            const codeTasks: CodeTaskType[] = pagePlan.components.map((component: ComponentType) => {
                const componentOverview = indexedOverviews[component.name];
                const fileSpec = indexedSpecs[component.componentType];
                if (!componentOverview) {
                    throw new Error(`Component overview not found for component type: ${component.componentType}`);
                }
                if (!fileSpec) {
                    throw new Error(`File spec not found for component type: ${component.componentType}`);
                }
                return { 
                    action: Task.ActionEnum.CREATE,
                    type: Task.TypeEnum.CodeTask,
                    subtype: CodeTask.SubtypeEnum.CREATE_COMPONENT,
                    status: Task.StatusEnum.PENDING,
                    componentOverviewId: componentOverview?.id,
                    componentType: component.componentType,
                    fileSpecificationId: fileSpec?.id,
                    websiteId: website.id,
                    projectId: website.projectId,
                }
            });

            const rawTasks = await tx.insert(tasksTable)
                .values(codeTasks)
                .onConflictDoNothing()
                .returning();
            const createdTasks = rawTasks;
            
            // Return all the data we need from the transaction
            return {
                page,
                componentOverviews: createdOverviews,
                fileSpecs,
                codeTasks: createdTasks,
            };
        });
    }
}