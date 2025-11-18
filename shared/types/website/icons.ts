import { primaryKeySchema } from "../core";
import { z } from "zod";

export const iconEmbeddingSchema = z.object({
  id: primaryKeySchema,
  key: z.string().describe("The key for the icon."),
  text: z.string().describe("A description of the icon."),
  embedding: z.array(z.number()).describe("The embedding for the icon."),
  metadata: z.record(z.string(), z.any()).optional().describe("Optional metadata for the icon."),
}).describe("An icon embedding");

export type IconEmbeddingType = z.infer<typeof iconEmbeddingSchema>;