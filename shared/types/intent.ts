import { z } from "zod";

// Base intent schema _ all intents have type, payload, and timestamp
export const baseIntentSchema = z.object({
  type: z.string(),
  payload: z.record(z.unknown()).default({}),
  createdAt: z.string(),
});

export type BaseIntent = z.infer<typeof baseIntentSchema>;

// Website intents
export const changeThemeIntentSchema = z.object({
  type: z.literal("change_theme"),
  payload: z.object({ themeId: z.number() }),
  createdAt: z.string(),
});

export const uploadImagesIntentSchema = z.object({
  type: z.literal("upload_images"),
  payload: z.object({ fileIds: z.array(z.number()) }),
  createdAt: z.string(),
});

export const deleteImageIntentSchema = z.object({
  type: z.literal("delete_image"),
  payload: z.object({ imageId: z.number() }),
  createdAt: z.string(),
});

export const improveCopyIntentSchema = z.object({
  type: z.literal("improve_copy"),
  payload: z.object({
    style: z.string().optional(),
  }),
  createdAt: z.string(),
});

export const websiteIntentSchema = z.discriminatedUnion("type", [
  changeThemeIntentSchema,
  uploadImagesIntentSchema,
  deleteImageIntentSchema,
  improveCopyIntentSchema,
]);

export type WebsiteIntent = z.infer<typeof websiteIntentSchema>;
export type ChangeThemeIntent = z.infer<typeof changeThemeIntentSchema>;
export type ImproveCopyIntent = z.infer<typeof improveCopyIntentSchema>;

// Brainstorm intents
export const skipTopicIntentSchema = z.object({
  type: z.literal("skip_topic"),
  payload: z.object({ topic: z.string() }),
  createdAt: z.string(),
});

export const doTheRestIntentSchema = z.object({
  type: z.literal("do_the_rest"),
  payload: z.object({}),
  createdAt: z.string(),
});

export const brainstormIntentSchema = z.discriminatedUnion("type", [
  skipTopicIntentSchema,
  doTheRestIntentSchema,
]);

export type BrainstormIntent = z.infer<typeof brainstormIntentSchema>;

// Navigation intent
export const navigationIntentSchema = z.object({
  type: z.literal("navigate"),
  payload: z.object({
    page: z.string(),
    path: z.string(),
  }),
  createdAt: z.string(),
});

export type NavigationIntent = z.infer<typeof navigationIntentSchema>;

// Union of all intent types
export const intentSchema = z.union([
  websiteIntentSchema,
  brainstormIntentSchema,
  navigationIntentSchema,
  baseIntentSchema, // Fallback for unknown intents
]);

export type Intent = z.infer<typeof intentSchema>;

// Type guard helpers
export function isChangeThemeIntent(intent: Intent): intent is ChangeThemeIntent {
  return intent.type === "change_theme";
}

export function isImproveCopyIntent(intent: Intent): intent is ImproveCopyIntent {
  return intent.type === "improve_copy";
}

export function isWebsiteIntent(intent: Intent): intent is WebsiteIntent {
  return ["change_theme", "upload_images", "delete_image", "improve_copy"].includes(intent.type);
}

export function isBrainstormIntent(intent: Intent): intent is BrainstormIntent {
  return ["skip_topic", "do_the_rest"].includes(intent.type);
}

export function isNavigationIntent(intent: Intent): intent is NavigationIntent {
  return intent.type === "navigate";
}
