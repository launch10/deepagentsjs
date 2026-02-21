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
export const helpMeIntentSchema = z.object({
  type: z.literal("help_me"),
  payload: z.object({}),
  createdAt: z.string(),
});

export const skipTopicIntentSchema = z.object({
  type: z.literal("skip_topic"),
  payload: z.object({}),
  createdAt: z.string(),
});

export const doTheRestIntentSchema = z.object({
  type: z.literal("do_the_rest"),
  payload: z.object({}),
  createdAt: z.string(),
});

export const brainstormIntentSchema = z.discriminatedUnion("type", [
  helpMeIntentSchema,
  skipTopicIntentSchema,
  doTheRestIntentSchema,
]);

export type BrainstormIntent = z.infer<typeof brainstormIntentSchema>;

// Ads intents
export const switchPageIntentSchema = z.object({
  type: z.literal("switch_page"),
  payload: z.object({ stage: z.string() }),
  createdAt: z.string(),
});

export const refreshAssetsIntentSchema = z.object({
  type: z.literal("refresh_assets"),
  payload: z.object({
    stage: z.string(),
    assets: z.array(
      z.object({
        asset: z.string(),
        nVariants: z.number(),
      })
    ),
  }),
  createdAt: z.string(),
});

export const adsIntentSchema = z.discriminatedUnion("type", [
  switchPageIntentSchema,
  refreshAssetsIntentSchema,
]);

export type AdsIntent = z.infer<typeof adsIntentSchema>;
export type SwitchPageIntent = z.infer<typeof switchPageIntentSchema>;
export type RefreshAssetsIntent = z.infer<typeof refreshAssetsIntentSchema>;

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
  adsIntentSchema,
  navigationIntentSchema,
  baseIntentSchema, // Fallback for unknown intents
]);

// Note: Intent can be null when cleared (LangGraph skips undefined state updates)
export type Intent = z.infer<typeof intentSchema> | null;

// Type guard helpers (handle null case)
export function isChangeThemeIntent(intent: Intent): intent is ChangeThemeIntent {
  return intent !== null && intent.type === "change_theme";
}

export function isImproveCopyIntent(intent: Intent): intent is ImproveCopyIntent {
  return intent !== null && intent.type === "improve_copy";
}

export function isWebsiteIntent(intent: Intent): intent is WebsiteIntent {
  return (
    intent !== null &&
    ["change_theme", "upload_images", "delete_image", "improve_copy"].includes(intent.type)
  );
}

export function isBrainstormIntent(intent: Intent): intent is BrainstormIntent {
  return intent !== null && ["help_me", "skip_topic", "do_the_rest"].includes(intent.type);
}

export function isSwitchPageIntent(intent: Intent): intent is SwitchPageIntent {
  return intent !== null && intent.type === "switch_page";
}

export function isRefreshAssetsIntent(intent: Intent): intent is RefreshAssetsIntent {
  return intent !== null && intent.type === "refresh_assets";
}

export function isAdsIntent(intent: Intent): intent is AdsIntent {
  return intent !== null && ["switch_page", "refresh_assets"].includes(intent.type);
}

export function isNavigationIntent(intent: Intent): intent is NavigationIntent {
  return intent !== null && intent.type === "navigate";
}

// Factory helpers — single source of truth for frontend + tests
export const switchPage = (stage: string): SwitchPageIntent => ({
  type: "switch_page" as const,
  payload: { stage },
  createdAt: new Date().toISOString(),
});

export const refreshAssets = (
  stage: string,
  assets: { asset: string; nVariants: number }[]
): RefreshAssetsIntent => ({
  type: "refresh_assets" as const,
  payload: { stage, assets },
  createdAt: new Date().toISOString(),
});
