import { z } from "zod";
import { primaryKeySchema, baseModelSchema } from "./core";

export enum ModeEnum {
    Magic = "Magic",
    Guided = "Guided"
}

export const projectSchema = baseModelSchema.extend({
    name: z.string().describe("Name of the project"),
    accountId: primaryKeySchema.optional().describe("ID of the user associated with the account owner"),
    threadId: z.string().optional().describe("ID of the thread associated with the project"),
}).describe("Represents a project");

export type Type = z.infer<typeof projectSchema>;
export type ProjectType = Type; // Alias for backward compatibility