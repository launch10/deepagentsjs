import { z } from "zod";
import { primaryKeySchema, baseModelSchema } from "../core";

export enum TypeEnum {
  CodeTask = "CodeTask",
  AdsTask = "AdsTask",
}

export enum ActionEnum {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
}

export enum StatusEnum {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export const taskSchema = baseModelSchema.extend({
  title: z.string().optional().describe("The title of this task."),
  type: z.nativeEnum(TypeEnum).describe("The type of task this represents."),
  status: z.nativeEnum(StatusEnum).describe("The status of this task."),
  action: z.nativeEnum(ActionEnum).optional().describe("The action to perform."),
  results: z.record(z.string(), z.any()).optional().describe("Results for this task."),
  path: z.string().optional().describe("The path to the file this task is associated with."),

  projectId: primaryKeySchema.optional().describe("The ID of the project this task is associated with."),
  websiteId: primaryKeySchema.optional().describe("The ID of the website this task is associated with."),
  websiteFileId: primaryKeySchema.optional().describe("The ID of the website file this task is associated with."),
});

export type TaskType = z.infer<typeof taskSchema>;