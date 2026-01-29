import { z } from "zod";

/**
 * Insights Types
 *
 * Defines the schema for analytics insights generation.
 * Input comes from Rails InsightsMetricsService, output is AI-generated insights.
 */

// ============================================================================
// Input Schemas (from Rails)
// ============================================================================

/**
 * Trend information for a metric
 */
export const trendSchema = z.object({
  direction: z.enum(["up", "down", "flat"]),
  percent: z.number(),
});

export type Trend = z.infer<typeof trendSchema>;

/**
 * Account-level totals
 */
export const totalsSchema = z.object({
  leads: z.number(),
  page_views: z.number(),
  ctr: z.number().nullable(),
  cpl: z.number().nullable(),
  ctr_available: z.boolean(),
  cpl_available: z.boolean(),
  // Extended metrics (optional, added as we enhance)
  roas: z.number().nullable().optional(),
  roas_available: z.boolean().optional(),
  total_spend_dollars: z.number().nullable().optional(),
});

export type Totals = z.infer<typeof totalsSchema>;

/**
 * Per-project summary
 */
export const projectSummarySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  total_leads: z.number(),
  total_page_views: z.number(),
  ctr: z.number().nullable(),
  cpl: z.number().nullable(),
  // Extended metrics
  days_since_last_lead: z.number().nullable().optional(),
  roas: z.number().nullable().optional(),
  spend_dollars: z.number().nullable().optional(),
});

export type ProjectSummary = z.infer<typeof projectSummarySchema>;

/**
 * Trend data for all metrics
 */
export const trendsSchema = z.object({
  leads_trend: trendSchema.nullable(),
  page_views_trend: trendSchema.nullable(),
  ctr_trend: trendSchema.nullable().optional(),
  cpl_trend: trendSchema.nullable().optional(),
});

export type Trends = z.infer<typeof trendsSchema>;

/**
 * Flags for quick insight detection
 */
export const flagsSchema = z.object({
  has_stalled_project: z.boolean().optional(),
  has_high_performer: z.boolean().optional(),
  has_new_first_lead: z.boolean().optional(),
});

export type Flags = z.infer<typeof flagsSchema>;

/**
 * Full metrics summary input from Rails
 */
export const metricsInputSchema = z.object({
  period: z.string().optional().default("Last 30 Days"),
  totals: totalsSchema,
  projects: z.array(projectSummarySchema),
  trends: trendsSchema,
  flags: flagsSchema.optional(),
});

export type MetricsInput = z.infer<typeof metricsInputSchema>;

// ============================================================================
// Output Schemas (AI-generated insights)
// ============================================================================

/**
 * Sentiment of an insight
 */
export const sentimentSchema = z.enum(["positive", "negative", "neutral"]);

export type Sentiment = z.infer<typeof sentimentSchema>;

/**
 * Action types that map to specific destinations in the app.
 * Each type has a deterministic URL builder and label.
 */
export const insightActionTypeSchema = z.enum([
  "review_ad_copy",
  "review_keywords",
  "adjust_budget",
  "pause_campaign",
  "review_landing_page",
  "view_leads",
]);

export type InsightActionType = z.infer<typeof insightActionTypeSchema>;

/**
 * Registry of action configurations.
 * Maps action types to labels and URL builders.
 */
export const ACTION_REGISTRY: Record<
  InsightActionType,
  {
    label: string;
    urlBuilder: (uuid: string) => string;
  }
> = {
  review_ad_copy: {
    label: "Review Ad Copy",
    urlBuilder: (uuid) => `/projects/${uuid}/campaigns/content`,
  },
  review_keywords: {
    label: "Review Keywords",
    urlBuilder: (uuid) => `/projects/${uuid}/campaigns/keywords`,
  },
  adjust_budget: {
    label: "Adjust Budget",
    urlBuilder: (uuid) => `/projects/${uuid}/campaigns/settings`,
  },
  pause_campaign: {
    label: "Pause Campaign",
    urlBuilder: (uuid) => `/projects/${uuid}/campaigns/settings`,
  },
  review_landing_page: {
    label: "Review Landing Page",
    urlBuilder: (uuid) => `/projects/${uuid}/website`,
  },
  view_leads: {
    label: "View Leads",
    urlBuilder: (uuid) => `/projects/${uuid}/leads`,
  },
};

/**
 * Action associated with an insight
 */
export const insightActionSchema = z.object({
  label: z.string().describe("Button text for the action (e.g., 'Review Keywords')"),
  url: z.string().describe("URL path to the relevant page (e.g., '/projects/:uuid/campaigns/content')"),
});

export type InsightAction = z.infer<typeof insightActionSchema>;

/**
 * LLM output schema for insight generation (intent-based).
 * Uses project_index instead of UUID for reliable identification.
 */
export const insightIntentSchema = z.object({
  title: z.string().max(50).describe("Short title (5 words max)"),
  description: z.string().describe("2-3 sentence explanation with specific numbers"),
  sentiment: sentimentSchema,
  project_index: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("1-indexed project number from the list, or null for account-wide"),
  action_type: insightActionTypeSchema.describe("The type of action to recommend"),
});

export type InsightIntent = z.infer<typeof insightIntentSchema>;

/**
 * Array of exactly 3 insight intents (LLM output)
 */
export const insightIntentsArraySchema = z.array(insightIntentSchema).length(3);

/**
 * A single generated insight
 */
export const insightSchema = z.object({
  title: z.string().max(50).describe("Short title (5 words max)"),
  description: z.string().describe("2-3 sentence explanation with specific numbers"),
  sentiment: sentimentSchema,
  project_uuid: z.string().nullable().describe("UUID if project-specific, null if account-wide"),
  action: insightActionSchema,
});

export type Insight = z.infer<typeof insightSchema>;

/**
 * Array of exactly 3 insights
 */
export const insightsArraySchema = z.array(insightSchema).length(3);

export type InsightsArray = z.infer<typeof insightsArraySchema>;

/**
 * Output from insights generation
 */
export const insightsOutputSchema = z.object({
  insights: insightsArraySchema,
  generated_at: z.string().datetime().optional(),
});

export type InsightsOutput = z.infer<typeof insightsOutputSchema>;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resolves a project index (1-indexed) to a UUID.
 *
 * @param index - 1-indexed project number, or null for account-wide
 * @param projects - Array of projects with uuid and name
 * @returns The project UUID, or null if index is null
 * @throws Error if index is out of range
 */
export function resolveProjectIndex(
  index: number | null,
  projects: Array<{ uuid: string; name: string }>
): string | null {
  if (index === null) return null;
  const project = projects[index - 1]; // Convert 1-indexed to 0-indexed
  if (!project) {
    throw new Error(`Invalid project index: ${index}. Valid range: 1-${projects.length}`);
  }
  return project.uuid;
}

/**
 * Resolves an action type to a full action with label and URL.
 *
 * @param actionType - The type of action
 * @param projectUuid - The project UUID to build the URL with
 * @returns InsightAction with label and URL
 * @throws Error if projectUuid is null (all current actions require a project)
 */
export function resolveInsightAction(
  actionType: InsightActionType,
  projectUuid: string | null
): InsightAction {
  const config = ACTION_REGISTRY[actionType];
  if (!projectUuid) {
    throw new Error(`Action ${actionType} requires a project UUID`);
  }
  return {
    label: config.label,
    url: config.urlBuilder(projectUuid),
  };
}

/**
 * Resolves an InsightIntent (LLM output) to a full Insight.
 *
 * @param intent - The intent from LLM output
 * @param projects - Array of projects with uuid and name
 * @returns A fully resolved Insight with action URL
 */
export function resolveInsightIntent(
  intent: InsightIntent,
  projects: Array<{ uuid: string; name: string }>
): Insight {
  const projectUuid = resolveProjectIndex(intent.project_index, projects);
  return {
    title: intent.title,
    description: intent.description,
    sentiment: intent.sentiment,
    project_uuid: projectUuid,
    action: resolveInsightAction(intent.action_type, projectUuid),
  };
}

/**
 * Creates a validated insight object
 */
export function createInsight(
  title: string,
  description: string,
  sentiment: Sentiment,
  action: InsightAction,
  projectUuid?: string | null
): Insight {
  return insightSchema.parse({
    title,
    description,
    sentiment,
    project_uuid: projectUuid ?? null,
    action,
  });
}
