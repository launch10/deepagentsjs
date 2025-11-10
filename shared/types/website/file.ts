import { z } from "zod";
import { 
  FileTypeEnum, 
  LayoutTypeEnum, 
  ConfigTypeEnum, 
  StyleTypeEnum, 
  LanguageEnum,
  PageTypeEnum,
  SectionTypeEnum 
} from "./enums";
import { primaryKeySchema, baseModelSchema } from "../core";
export type { ComponentType } from "./component";

// Basic file schema
export const fileSchema = z.object({
  path: z.string().describe("Path of the file"),
  content: z.string().describe("Content of the file"),
  fileSpecificationId: z.number().optional().describe("ID of the file specification"),
});

export type FileType = z.infer<typeof fileSchema>;
export type FileMap = Record<string, FileType>;

// Re-export enums
export { 
  FileTypeEnum as TypeEnum,
  LayoutTypeEnum,
  ConfigTypeEnum,
  StyleTypeEnum,
  LanguageEnum 
} from "./enums";

// Specification types
export const specificationSubtypeSchema = z.union([
  z.nativeEnum(PageTypeEnum),
  z.nativeEnum(SectionTypeEnum),
  z.nativeEnum(StyleTypeEnum),
  z.nativeEnum(LayoutTypeEnum),
  z.nativeEnum(ConfigTypeEnum)
]);
export type SpecificationSubtypeType = z.infer<typeof specificationSubtypeSchema>;

export const fileSpecSchema = baseModelSchema.extend({
  canonicalPath: z.string(),
  description: z.string().optional(),
  filetype: z.nativeEnum(FileTypeEnum),
  componentType: specificationSubtypeSchema,
  language: z.nativeEnum(LanguageEnum),
});
export type FileSpecType = z.infer<typeof fileSpecSchema>;

export const websiteFileSchema = baseModelSchema.extend({
  path: z.string(),
  content: z.string(),
  websiteId: primaryKeySchema,
  fileSpecificationId: primaryKeySchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  shasum: z.string(),
});
export type WebsiteFileType = z.infer<typeof websiteFileSchema>;

export enum CodeFileSourceEnum {
  Template = "template",
  Website = "website",
}

export const codeFileSchema = baseModelSchema.extend({
  path: z.string(),
  content: z.string(),
  websiteId: primaryKeySchema,
  fileSpecificationId: primaryKeySchema.optional(),
  createdAt: z.date().or(z.string()), // Views may return dates as strings
  updatedAt: z.date().or(z.string()), // Views may return dates as strings
  shasum: z.string().nullable(),
  source: z.nativeEnum(CodeFileSourceEnum).describe("Has the user overidden the template file? Or are they using the default version of this file with no changes?"),
  contentTsv: z.any().optional(), // tsvector type
});
export type CodeFileType = z.infer<typeof codeFileSchema>;