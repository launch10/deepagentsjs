import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';

// Explicitly type as string instead of using ReturnType
export type UUIDType = string & { readonly __brand: 'UUID' };

export const uuidSchema = z.string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "Invalid UUID format")
    .transform((val: string) => val as UUIDType);

// Helper to generate UUIDs with proper typing
export const generateUUID = (): UUIDType => uuidv4() as UUIDType;

export const primaryKeySchema = z.number();
export type PrimaryKeyType = number;

export const railsDatetimeSchema = z.string().refine(
  (val) => {
    // Accept ISO 8601 format with timezone (e.g., "2025-09-24T15:30:45.123Z")
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    // Accept PostgreSQL/Rails format (e.g., "2025-09-20 15:45:11.707" or "2025-05-08 19:28:51.784211")
    const postgresRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;
    
    return iso8601Regex.test(val) || postgresRegex.test(val);
  },
  { message: "Invalid datetime format. Expected ISO 8601 or PostgreSQL timestamp format" }
);
export type RailsDatetimeType = string;

export const baseModelSchema = z.object({
  id: primaryKeySchema.optional().describe("ID of the model"),
  createdAt: railsDatetimeSchema.optional().describe("The date the model was created."),
  updatedAt: railsDatetimeSchema.optional().describe("The date the model was last updated."),
});

export type BaseModelType = z.infer<typeof baseModelSchema>;

export type DataType<T extends BaseModelType> = Omit<T, keyof BaseModelType>;

export interface SchemaFewShotExample<T extends z.ZodType<any>> {
    input: string;
    output: z.infer<T>;
}
export interface FewShotExampleType {
    input: string;
    output: string;
}