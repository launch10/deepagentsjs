import {
  type CodeTaskType,
  type ComponentOverviewType,
  type ComponentContentPlanType,
  type FileSpecType,
  type WebsiteType,
  type ThemeVariantType,
} from "@types";
import { 
  ComponentContentPlanModel, 
  ComponentOverviewModel, 
  FileSpecificationModel, 
  CodeTaskModel,
  ComponentModel,
  WebsiteFileModel,
} from "@models";
import { 
  db, eq,
  tasks as tasksTable,
  websiteFiles as websiteFilesTable,
  components as componentsTable,
  componentOverviews as componentOverviewsTable,
  componentContentPlans as componentContentPlansTable 
} from "@db";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { Theme } from "app/shared/types/website";
import { ThemeVariantModel } from "app/models/themeVariant";

export type SaveComponentProps = {
    componentOverview?: ComponentOverviewType;
    contentPlan?: ComponentContentPlanType;
    fileSpec?: FileSpecType;
    website: WebsiteType;
    task: CodeTaskType;
    themeVariant: ThemeVariantType;
}

export type SaveComponentOutputType = {
    task: CodeTaskType;
    website: WebsiteType;
}

export class SaveComponentService {
    async execute(input: SaveComponentProps, config?: LangGraphRunnableConfig): Promise<SaveComponentOutputType> {
      if (!input.task) {
          throw new Error('task is required');
      }
      const task = input.task;
      if (!task.results || !task.results?.code || task.results?.code.length === 0) {
          throw new Error('task results.code cannot be empty!');
      }
      const website = input.website;
      const contentPlan = input.contentPlan || await ComponentContentPlanModel.findBy({
          componentOverviewId: input.task.componentOverviewId,
      });
      if (!contentPlan) {
          throw new Error('contentPlan is required');
      }
      const overview = input.componentOverview || await ComponentOverviewModel.find(contentPlan.componentOverviewId);
      if (!overview) {
          throw new Error('overview is required');
      }
      const fileSpec = input.fileSpec || await FileSpecificationModel.findBy({componentType: overview.componentType});
      if (!fileSpec) {
          throw new Error('fileSpec is required');
      }
      if (!input.website) {
          throw new Error('website is required');
      }

      // TODO: Remember that HISTORIES tables only work/exist in Rails. We should
      // go through the Rails API to create/update these.
      // Expose an API then update.
      return await db.transaction(async (tx) => {
        // create website file
        const [websiteFile] = await tx.insert(
          websiteFilesTable
        ).values(
          {
            websiteId: website.id!,
            fileSpecificationId: fileSpec.id!,
            path: overview.path,
            content: task.results.code!
          }
        )
        .onConflictDoUpdate({
          target: [websiteFilesTable.websiteId, websiteFilesTable.path],
          set: {
            content: task.results.code!
          }
        })
        .returning({ id: websiteFilesTable.id, path: websiteFilesTable.path });

        // create component
        const [component] = await tx
            .insert(componentsTable)
            .values({
              name: overview.name,
              path: overview.path,
              componentType: overview.componentType,
              componentOverviewId: overview.id!,
              componentContentPlanId: contentPlan.id!,
              pageId: overview.pageId,
              fileSpecificationId: fileSpec.id!,
              themeVariantId: input.themeVariant.id!,
              websiteFileId: websiteFile.id!,
              websiteId: website.id!,
            })
            .returning();

        // save task
        const [updatedTask] = await tx
          .update(tasksTable)
          .set({
            websiteFileId: websiteFile.id!,
            componentId: component.id!,
            results: task.results, // Include the results
            status: task.status, // Include the status
          })
          .where(eq(tasksTable.id, task.id!))
          .returning();

        const [updatedContentPlan] = await tx
          .update(componentContentPlansTable)
          .set({
            componentId: component.id!,
          })
          .where(eq(componentContentPlansTable.id, contentPlan.id))
          .returning();

        const [updatedOverview] = await tx
          .update(componentOverviewsTable)
          .set({
            componentId: component.id!,
          })
          .where(eq(componentOverviewsTable.id, overview.id!))
          .returning();

        return {
          task: updatedTask,
          component: component,
          contentPlan: updatedContentPlan,
          overview: updatedOverview,
        }
      });
    }
}