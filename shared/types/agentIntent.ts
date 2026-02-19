import { z } from "zod";
import { WorkflowPages } from "../config/workflow";

// Base agent intent schema — all agent intents have type, payload, and timestamp
export const baseAgentIntentSchema = z.object({
  type: z.string(),
  payload: z.record(z.unknown()).default({}),
  createdAt: z.string(),
});

export type BaseAgentIntent = z.infer<typeof baseAgentIntentSchema>;

// Navigate intent — agent wants the frontend to navigate to a workflow page
export const navigateAgentIntentSchema = z.object({
  type: z.literal("navigate"),
  payload: z.object({
    page: z.enum(WorkflowPages),
    substep: z.string().optional(),
  }),
  createdAt: z.string(),
});

export type NavigateAgentIntent = z.infer<typeof navigateAgentIntentSchema>;

// Brand intents — each brand action is its own intent type
const brandIntentTypes = [
  "logo_set",
  "color_scheme_applied",
  "social_links_saved",
  "images_associated",
] as const;

export type BrandIntentType = (typeof brandIntentTypes)[number];

export const brandAgentIntentSchema = z.object({
  type: z.enum(brandIntentTypes),
  payload: z.record(z.unknown()).default({}),
  createdAt: z.string(),
});

export type BrandAgentIntent = z.infer<typeof brandAgentIntentSchema>;

// Union of all agent intent types
export const agentIntentSchema = z.union([
  navigateAgentIntentSchema,
  brandAgentIntentSchema,
  baseAgentIntentSchema, // Fallback for unknown intents
]);

export type AgentIntent = z.infer<typeof agentIntentSchema>;

// Type guards
export function isNavigateAgentIntent(intent: AgentIntent): intent is NavigateAgentIntent {
  return intent.type === "navigate";
}

export function isBrandAgentIntent(intent: AgentIntent): intent is BrandAgentIntent {
  return brandIntentTypes.includes(intent.type as BrandIntentType);
}

// Factories
export const navigateTo = (page: string, substep?: string): NavigateAgentIntent => ({
  type: "navigate" as const,
  payload: { page: page as NavigateAgentIntent["payload"]["page"], substep },
  createdAt: new Date().toISOString(),
});

export const brandIntent = (type: BrandIntentType): BrandAgentIntent => ({
  type,
  payload: {},
  createdAt: new Date().toISOString(),
});

// Backwards-compatible alias
export const brandUpdated = brandIntent;
