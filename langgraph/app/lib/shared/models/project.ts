import { z } from "zod";
import { pageSchema } from "./page";
import { projectPlanSchema } from "./project/projectPlan";

export { projectPlanSchema }

export enum InitializeProjectStatus {
    Initialized = "Initialized",
    Started = "Started",
    Failed = "Failed"
}

export enum ProjectMode {
    Magic = "Magic",
    Guided = "Guided"
}

export const projectSchema = z.object({
    projectName: z.string().describe("Name of the project"),
    tenantId: z.number().optional().describe("ID of the user associated with the project"),
    themeId: z.number().optional().describe("ID of the theme associated with the project"),
    projectMode: z.nativeEnum(ProjectMode).default(ProjectMode.Magic).describe("Mode of the project (Magic or Guided)"),
    rootPath: z.string().optional(),
    backupPath: z.string().optional(),
    projectPlan: projectPlanSchema.describe("Project plan"),
    pages: z.array(pageSchema).describe("Pages in the project"),
});

export type ProjectData = z.infer<typeof projectSchema>;
