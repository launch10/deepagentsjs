import { z } from "zod";
import { contentPlanSchema, sectionOverviewSchema, sectionSchema } from "./section";
import { fileSpecificationSchema } from "./fileSpecification";

export enum CodeTaskType {
    CREATE_PAGE = "CREATE_PAGE",
    CREATE_SECTION = "CREATE_SECTION",
    UPDATE = "UPDATE",
    INSTALL = "INSTALL",
    SHELL = "SHELL",
    DELETE = "DELETE",
    RENAME = "RENAME",
    ADD_DEPENDENCY = "ADD_DEPENDENCY",
    REMOVE_DEPENDENCY = "REMOVE_DEPENDENCY",
    MOUNT_FILES = "MOUNT_FILES",
    DEV_SERVER = "DEV_SERVER"
}

export enum CodeTaskAction {
    UPDATE = "UPDATE",
    DELETE = "DELETE",
}

export enum TaskStatus {
    PENDING = "PENDING",
    IN_PROGRESS = "IN_PROGRESS",
    PLANNED = "PLANNED",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

export const CodeTaskDescriptions = {
    [CodeTaskType.CREATE_SECTION]: "Create a new page section (e.g. Benefits, Features, Hero, etc)",
    [CodeTaskType.CREATE_PAGE]: "Create a new page (e.g. PricingPage, IndexPage)",
    [CodeTaskType.UPDATE]: "Update existing page section (e.g. Hero, Testimonials, Pricing, etc)",
}

export const codeTaskPlanSchema = z.object({
   filePath: z.string().describe("The relative path of the file to update (must be one of the provided file paths)."),
   type: z.nativeEnum(CodeTaskType).describe("The type of task to perform."),
   instruction: z.string().describe("The specific instruction derived from the user request relevant to this plan type."),
   sectionOverview: sectionOverviewSchema.optional().describe("The overview of the section, if this is a CREATE_SECTION task."),
   userPrompt: z.string().describe("The original user prompt for context.")
}).describe("The plan for this task.");
export type CodeTaskPlan = z.infer<typeof codeTaskPlanSchema>;

export const codeTaskPlansSchema = z.object({
    tasks: z.array(codeTaskPlanSchema).describe("List of code task plans")
}).describe("List of code task plans");

export const codeTaskResultSchema = z.object({
  filePath: z.string().optional().describe("The relative path of the updated file."),
  code: z.string().describe("The generated code as a single string."),
  dependencies: z.array(z.string()).optional().describe(`
    List of npm package dependencies required by the component. 
    Any dependencies you list will be INSTALLED via npm.
    So you MUST explicitly list dependencies in the format <package-name>@<version>.
    If this was an update, ONLY list new dependencies, not existing dependencies.
  `),
  summary: z.string().optional().describe("A summary of the changes made.")
})
export type CodeTaskResult = z.infer<typeof codeTaskResultSchema>;

export const multipleCodeTaskResultsSchema = z.object({
    tasks: z.array(codeTaskResultSchema).describe("List of code task results")
}); 
export type MultipleCodeTaskResults = z.infer<typeof multipleCodeTaskResultsSchema>;

export const codeTaskChangesSchema = z.object({
    originalContent: z.string().optional().describe("The original content of the file before modification."),
    modifiedContent: z.string().describe("The generated code as a single string."),
    dependencies: z.array(z.string()).optional().describe("List of npm package dependencies required by the component. If this was an update, these should only be NEW dependencies, not existing dependencies.")
})
export type CodeTaskChanges = z.infer<typeof codeTaskChangesSchema>;

const taskPayloadSchema = z.record(z.string(), z.any());
export type TaskPayload = z.infer<typeof taskPayloadSchema>;

export const codeTaskSchema = z.object({
    id: z.string().describe("Unique identifier for this task."),
    title: z.string().optional().describe("The title of this task."),
    type: z.nativeEnum(CodeTaskType).describe("The type of task to perform."),
    action: z.nativeEnum(CodeTaskAction).optional().describe("The action to perform."),
    status: z.nativeEnum(TaskStatus).describe("The status of this task."),
    filePath: z.string().optional().describe("The relative path of the file to update (must be one of the provided file paths)."),
    section: sectionSchema.optional().describe("The section to update."),
    fileSpec: fileSpecificationSchema.optional().describe("The file specification for this task."),
    instruction: z.string().optional().describe("The instruction provided by the user."),
    additionalFileContext: z.array(z.string()).optional().describe("Additional files that may be relevant to the task."),
    contentPlan: contentPlanSchema.optional().describe("The content plan for this task."),
    plan: codeTaskPlanSchema.optional().describe("The plan for this task."),
    results: codeTaskResultSchema.optional().describe("The results of this task."),
    payload: taskPayloadSchema.optional().describe("The payload for this task (generally used for frontend actions)."),
    changes: codeTaskChangesSchema.optional().describe("The changes made to the file."),
    success: z.boolean().optional().describe("Whether the task was successful.")
});
export type CodeTask = z.infer<typeof codeTaskSchema>;

export const identifiedCodeTaskSchema = codeTaskSchema.extend({
    filePath: z.string().describe("The relative path of the file to update (must be one of the provided file paths)."),
    instruction: z.string().describe("The instruction provided by the user."),
}).describe("The identified file and instruction.");
export type IdentifiedCodeTask = z.infer<typeof identifiedCodeTaskSchema>;

export const plannedCreateCodeTaskSchema = identifiedCodeTaskSchema.extend({
    contentPlan: contentPlanSchema.describe("The plan for this task.")
}).describe("The content plan for this task.");
export type PlannedCreateCodeTask = z.infer<typeof plannedCreateCodeTaskSchema>;

export const plannedCodeTaskSchema = identifiedCodeTaskSchema.extend({
    plan: codeTaskPlanSchema.describe("The plan for this task.")
})
export type PlannedCodeTask = z.infer<typeof plannedCodeTaskSchema>;

export const completedCodeTaskSchema = plannedCodeTaskSchema.extend({
    results: codeTaskResultSchema.describe("The results of this task."),
    // changes: codeTaskChangesSchema.describe("The changes made to the file.")
})
export type CompletedCodeTask = z.infer<typeof completedCodeTaskSchema>;

export const codeTaskSummarySchema = z.object({
    type: z.nativeEnum(CodeTaskType).describe("The type of task this represents."),
    filePath: z.string().describe("The relative path of the updated file"),
    instruction: z.string().describe("The instruction that generated this task."),
    summary: z.string().optional().describe("A summary of the changes made."),
})

export type CodeTaskSummary = z.infer<typeof codeTaskSummarySchema>;