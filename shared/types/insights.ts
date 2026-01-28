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
 * Action associated with an insight
 */
export const insightActionSchema = z.object({
  label: z.string().describe("Button text for the action (e.g., 'Review Keywords')"),
  url: z.string().describe("URL path to the relevant page (e.g., '/projects/:uuid/campaigns/content')"),
});

export type InsightAction = z.infer<typeof insightActionSchema>;

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
 * Available action URLs for insights
 */
export const ACTION_URLS = {
  REVIEW_AD_COPY: (uuid: string) => `/projects/${uuid}/campaigns/content`,
  REVIEW_LANDING_PAGE: (uuid: string) => `/projects/${uuid}/website`,
  ADJUST_TARGETING: (uuid: string) => `/projects/${uuid}/campaigns/targeting`,
  ADJUST_BUDGET: (uuid: string) => `/projects/${uuid}/campaigns/budget`,
  VIEW_PROJECT: (uuid: string) => `/projects/${uuid}`,
  VIEW_ANALYTICS: (uuid: string) => `/projects/${uuid}/analytics`,
} as const;

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
