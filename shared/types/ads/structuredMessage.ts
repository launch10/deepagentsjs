import z from "zod";
import { StreamedSnippetsSchema, StreamedAssetSchema } from "./assets";

export const jsonSchema = z.object({
  headlines: StreamedAssetSchema.max(6).describe(`List of headlines to include`).optional(),
  descriptions: StreamedAssetSchema.max(4).describe(`List of descriptions to include`).optional(),
  features: StreamedAssetSchema.max(6).describe(`List of features to include`).optional(),
  structuredSnippets: StreamedSnippetsSchema.optional(),
  keywords: StreamedAssetSchema.max(10).describe(`List of keywords to include`).optional(),
});