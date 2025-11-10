import { z } from "zod";
import * as Core from "./core";
import { componentSchema, ComponentTypeEnum } from "../website";
import { primaryKeySchema, uuidSchema } from "../core";
import { StatusEnum } from "./core";

export enum SubtypeEnum {
  CREATE_PAGE = "CREATE_PAGE",
  CREATE_COMPONENT = "CREATE_COMPONENT",
  UPDATE = "UPDATE",
  BUG_FIX = "BUG_FIX",
}

export const SubtypeDescriptions: Record<SubtypeEnum, string> = {
  [SubtypeEnum.CREATE_PAGE]: "Create a new page (e.g. PricingPage, IndexPage)",
  [SubtypeEnum.CREATE_COMPONENT]: "Create a new page section (e.g. Benefits, Features, Hero, etc)",
};

export const resultSchema = z.object({
  code: z.string().describe("The generated source code for the component."),
  dependencies: z.array(z.string()).default([]).describe("List of npm package dependencies required by the component. If this was an update, these should only be NEW dependencies, not existing dependencies."),
  summary: z.string().optional().describe("A summary of the changes made."),
});
export type ResultType = z.infer<typeof resultSchema>;

export const codeTaskSchema = Core.taskSchema.extend({
  type: z.literal(Core.TypeEnum.CodeTask).describe("The type of task this represents."),
  subtype: z.nativeEnum(SubtypeEnum).optional().describe("The subtype of task this represents."),
  instructions: z.string().optional().describe("Instructions for the task."),
  results: resultSchema.optional().describe("The results of this task."),
  componentType: z.nativeEnum(ComponentTypeEnum).optional().describe("The component type for this task."),

  componentId: primaryKeySchema.optional().describe("The ID of the component to update."),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this task."),
  fileSpecificationId: primaryKeySchema.optional().describe("The file spec ID for this task."),
});

export type CodeTaskType = z.infer<typeof codeTaskSchema>;

// Todos what the model produces. They have a simpler output format than CodeTasks.
// Then we map them to CodeTasks.
export const todoSchema = z.object({
  title: z.string().describe("The title of this todo."),
  instructions: z.string().describe("The instructions for this todo."),
  path: z.string().describe("The file path that need to be created or modified for this todo."),
  type: z.nativeEnum(SubtypeEnum).describe("The type of todo this represents."),
});

export type TodoType = z.infer<typeof todoSchema>;

export const todoListSchema = z.object({
  todos: z.array(todoSchema).describe("The list of todos for this task.")
});

export type TodoListType = z.infer<typeof todoListSchema>;
