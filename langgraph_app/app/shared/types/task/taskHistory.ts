import { z } from "zod";
import * as Core from "./core";
import { primaryKeySchema } from "../core";

export const taskHistorySchema = z.object({
  type: z.nativeEnum(Core.TypeEnum).describe("The type of task this represents."),
  websiteId: primaryKeySchema.describe("The ID of the website this task was applied to."),
  componentId: z.string().optional().describe("The ID of the component this task was applied to."),
  filePath: z.string().optional().describe("The path of the file this task was applied to."),
  summary: z.string().describe("A summary of the changes made."),
}).describe("Represents a task history record");

export type TaskHistoryType = z.infer<typeof taskHistorySchema>;