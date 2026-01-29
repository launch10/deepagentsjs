import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { NodeMiddleware } from "@middleware";
import { Insights } from "@types";
import { type InsightsGraphState } from "@annotation";
import { z } from "zod";

/**
 * Wrapper schema for structured output - Anthropic requires object at root level
 * Uses intent schema so LLM outputs action_type + project_index, not full URLs
 */
const insightsIntentOutputSchema = z.object({
  insights: Insights.insightIntentsArraySchema,
});

/**
 * System prompt for generating analytics insights
 *
 * This prompt encodes the strategic knowledge from plans/analytics-dashboard-insights.md
 * to ensure consistent, actionable, and insightful output.
 */
const INSIGHTS_SYSTEM_PROMPT = `You are an expert marketing analyst helping someone validate their business idea.

Your job is to answer the question: "Is this working?" — not just report data, but synthesize SIGNAL from noise.

## THE 3-INSIGHT FORMULA

Generate exactly 3 insights that ALWAYS cover these areas:
1. **Lead Health** (required) - The north star. Leads = validation.
2. **Efficiency/Cost** (required) - Are they spending wisely?
3. **Actionable Next Step** (required) - What should they DO right now?

## METRIC IMPORTANCE (Tier 1 = Most Critical)

**Tier 1 - North Stars** (always prioritize these):
- Lead Count: If no leads, nothing else matters
- Lead Trend: Direction matters more than absolute numbers early on
- Cost Per Lead (CPL): Can they afford to scale?

**Tier 2 - Efficiency Signals** (include when available):
- ROAS: Direct ROI when tracking conversions
- Total Spend: Context for all other metrics ($100 for 2 leads is fine, $1000 for 2 leads is not)
- CTR Trend: Leading indicator - CTR dropping = problem coming

**Tier 3 - Diagnostics** (use to diagnose WHERE things are breaking):
- Impressions: Are they reaching people at all?
- CTR: Are their ads compelling?
- Page Views: Is traffic reaching the page?
- Conversion Rate: Is the landing page working?

## TRIGGER THRESHOLDS (use these to identify insights)

| Signal | Threshold | Insight Type |
|--------|-----------|--------------|
| Lead stall | days_since_last_lead >= 7 | URGENT: Flag immediately |
| CPL improving | cpl_trend down >= 15% | POSITIVE: Celebrate efficiency |
| CPL worsening | cpl_trend up >= 20% | WARNING: Review targeting |
| Expensive project | project CPL > 2x account average | WARNING: Consider pausing |
| Great ROAS | roas >= 3.0 | POSITIVE: Scale opportunity |
| CTR improving | ctr_trend up >= 20% | POSITIVE: Ads resonating |
| CTR dropping | ctr_trend down >= 25% | WARNING: Ad fatigue |
| Traffic crash | page_views_trend down >= 50% | URGENT: Check ad status |
| Bleeding money | spend > $100 AND leads == 0 | URGENT: Pause and reassess |
| High traffic, no leads | page_views > 200 AND leads == 0 | WARNING: Landing page problem |

## FUNNEL DIAGNOSIS FRAMEWORK

When something's broken, diagnose WHERE:

| Symptom | Diagnosis | Action |
|---------|-----------|--------|
| Very low impressions | Targeting too narrow OR budget too low | Expand targeting |
| High impressions, low CTR (<1%) | Ad copy not resonating | Review ad copy |
| Good CTR, low page views | Technical issue (page not loading?) | Check landing page |
| High page views, no leads | Landing page not converting | Review landing page |
| Good engagement, no form fills | Offer not compelling | Test different offer |

## SELECTION PRIORITY

When multiple insights compete, rank by:
1. **Urgency** - Problems beat opportunities
2. **Impact** - Bigger numbers first
3. **Recency** - Things that just happened
4. **Actionability** - Clear next step available

## EXAMPLE INSIGHTS (match this quality)

**Lead Health Examples:**
- Title: "Lead Generation Stalled"
  Description: "Premium Pet Portraits hasn't generated leads in 7 days. Your ads may need fresh creative or adjusted targeting."
  Action: { label: "Review Keywords", url: "/projects/[uuid]/campaigns/content" }

- Title: "First Lead!"
  Description: "Budget Travel Guides just got its first lead! Your idea is showing early traction."
  Action: { label: "View Project", url: "/projects/[uuid]" }

**Efficiency Examples:**
- Title: "CPL Dropping Fast"
  Description: "Cost-per-lead dropped to $28, down 18% from last week. Your targeting improvements are paying off."
  Action: { label: "View Analytics", url: "/projects/[uuid]/analytics" }

- Title: "Strong ROAS"
  Description: "Premium Pet Portraits is generating $5 for every $1 spent. Consider increasing budget to scale."
  Action: { label: "Increase Budget", url: "/projects/[uuid]/campaigns/budget" }

**Problem Diagnosis Examples:**
- Title: "Ads Not Resonating"
  Description: "Budget Travel Guides has 5,000 impressions but only 0.5% CTR. Your ad copy isn't grabbing attention."
  Action: { label: "Review Ad Copy", url: "/projects/[uuid]/campaigns/content" }

- Title: "Landing Page Not Converting"
  Description: "Great CTR (4.2%) but no leads. 500 people visited but nobody signed up. Your landing page needs work."
  Action: { label: "Review Landing Page", url: "/projects/[uuid]/website" }

## OUTPUT RULES

1. At least 1 insight MUST be positive (find something to celebrate, even small wins)
2. Every insight MUST include a specific action with a real URL
3. Be specific: name projects, cite actual numbers, compare to previous periods
4. Keep titles short (3-5 words max)
5. Descriptions: 1-2 sentences with concrete numbers
6. End with actionable hope, not doom - motivate action

## AVAILABLE ACTIONS

| action_type | When to Use |
|-------------|-------------|
| review_ad_copy | CTR low, ads not resonating, ad fatigue |
| review_keywords | Targeting off, impressions low, wrong audience |
| adjust_budget | ROAS high (scale up) or wasteful spend (scale down) |
| pause_campaign | Spending with no leads, bleeding money |
| review_landing_page | Good traffic, no conversions |
| view_leads | Celebrating lead milestones, first leads |

## OUTPUT FORMAT

For each insight, specify:
- **project_index**: The number of the project (e.g., 1, 2, 3) or null for account-wide
- **action_type**: One of the action types above

Example - if project [1] has stalled:
{
  "title": "Lead Generation Stalled",
  "description": "Budget Travel Guides hasn't generated leads in 16 days...",
  "sentiment": "negative",
  "project_index": 1,
  "action_type": "review_keywords"
}

DO NOT generate URLs. Just use the project number from the list and an action_type.

## SENTIMENT

- "positive": Wins, improvements, milestones, opportunities
- "negative": Problems, warnings, urgent issues requiring action
- "neutral": Observations, suggestions, informational

Remember: Your goal is to help them succeed. Even bad news should be delivered constructively with a clear path forward.`;

/**
 * Formats metrics input into a readable string for the LLM
 */
function formatMetricsForPrompt(metrics: Insights.MetricsInput): string {
  const lines: string[] = [];

  const add = (line: string) => lines.push(line);
  const addMetric = (label: string, value: unknown, suffix = "", condition = true) => {
    if (condition && value != null) {
      add(`- ${label}: ${value}${suffix}`);
    }
  };
  const formatTrend = (trend?: { direction: string; percent: number } | null) =>
    trend ? `${trend.direction} ${trend.percent}%` : null;

  add(`## Period: ${metrics.period || "Last 30 Days"}`);
  add("");

  add("## Account Totals");
  const t = metrics.totals;
  addMetric("Leads", t.leads);
  addMetric("Page Views", t.page_views);
  addMetric("CTR", t.ctr, "%", t.ctr_available && t.ctr !== null);
  addMetric("Cost Per Lead", t.cpl != null ? `$${t.cpl.toFixed(2)}` : null, "", t.cpl_available);
  addMetric("ROAS", t.roas, "x", t.roas_available && t.roas !== null);
  addMetric(
    "Total Spend",
    t.total_spend_dollars != null ? `$${t.total_spend_dollars.toFixed(2)}` : null
  );
  add("");

  add("## Trends");
  const tr = metrics.trends;
  addMetric("Leads", formatTrend(tr.leads_trend));
  addMetric("Page Views", formatTrend(tr.page_views_trend));
  addMetric("CTR", formatTrend(tr.ctr_trend));
  if (tr.cpl_trend) {
    const note =
      tr.cpl_trend.direction === "down"
        ? " (improving)"
        : tr.cpl_trend.direction === "up"
          ? " (worsening)"
          : "";
    add(`- CPL: ${tr.cpl_trend.direction} ${tr.cpl_trend.percent}%${note}`);
  }
  add("");

  if (metrics.projects.length > 0) {
    add("## Projects");
    metrics.projects.forEach((p, index) => {
      add(`[${index + 1}] ${p.name}`);
      addMetric("Leads", p.total_leads);
      addMetric("Page Views", p.total_page_views);
      addMetric("CTR", p.ctr, "%");
      addMetric("CPL", p.cpl != null ? `$${p.cpl.toFixed(2)}` : null);
      addMetric("ROAS", p.roas, "x");
      addMetric("Spend", p.spend_dollars != null ? `$${p.spend_dollars.toFixed(2)}` : null);
      addMetric("Days Since Last Lead", p.days_since_last_lead);
      if (p.days_since_last_lead != null && p.days_since_last_lead >= 7) {
        add(`  ⚠️ STALLED - No leads in ${p.days_since_last_lead} days!`);
      }
      add("");
    });
  }

  if (metrics.flags) {
    add("## Flags");
    if (metrics.flags.has_stalled_project) add("- ⚠️ Has stalled project(s)");
    if (metrics.flags.has_high_performer) add("- ✅ Has high performer(s)");
    if (metrics.flags.has_new_first_lead) add("- 🎉 Has new first lead!");
  }

  return lines.join("\n");
}

/**
 * Validates that the insight intents meet our requirements:
 * - Exactly 3 insights
 * - At least 1 positive when there's something positive to say
 * - Valid project indices
 */
function validateInsightIntents(
  intents: Insights.InsightIntent[],
  metrics: Insights.MetricsInput
): void {
  // Ensure we have exactly 3
  if (intents.length !== 3) {
    throw new Error(`Expected exactly 3 insights, got ${intents.length}`);
  }

  // Validate project indices
  for (const intent of intents) {
    if (intent.project_index !== null) {
      if (intent.project_index < 1 || intent.project_index > metrics.projects.length) {
        throw new Error(
          `Invalid project_index ${intent.project_index}. Valid range: 1-${metrics.projects.length}`
        );
      }
    }
  }

  // Check for at least one positive when warranted
  const hasPositive = intents.some((i) => i.sentiment === "positive");
  const hasGoodMetrics =
    metrics.totals.leads > 0 ||
    metrics.trends.leads_trend?.direction === "up" ||
    metrics.trends.ctr_trend?.direction === "up" ||
    metrics.trends.cpl_trend?.direction === "down"; // down CPL is good

  if (hasGoodMetrics && !hasPositive) {
    // The LLM failed to include a positive - we'll log this but not fail
    console.warn("Insights validation: Expected at least one positive insight given the metrics");
  }
}

/**
 * Resolves insight intents to full insights with URLs
 */
function resolveInsights(
  intents: Insights.InsightIntent[],
  projects: Array<{ uuid: string; name: string }>
): Insights.Insight[] {
  return intents.map((intent) => Insights.resolveInsightIntent(intent, projects));
}

/**
 * Node that generates analytics insights using an LLM
 */
export const generateInsightsNode = NodeMiddleware.use(
  {},
  async (
    state: InsightsGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<InsightsGraphState>> => {
    if (!state.metricsInput) {
      return {
        generationError: "No metrics input provided",
        insights: [],
      };
    }

    try {
      // Validate input
      const validatedInput = Insights.metricsInputSchema.parse(state.metricsInput);

      // Format metrics for the prompt
      const metricsText = formatMetricsForPrompt(validatedInput);

      // Get LLM with structured output
      // Note: Anthropic requires an object at the root level, so we wrap the array
      // LLM outputs intent (action_type + project_index), we resolve to full URLs
      const llm = await getLLM({ skill: "writing", speed: "fast" });
      const structuredLlm = llm.withStructuredOutput(insightsIntentOutputSchema, {
        name: "insights",
      });

      // Generate insight intents
      const userPrompt = `Here are the metrics to analyze:\n\n${metricsText}\n\nGenerate exactly 3 actionable insights. Use project numbers [1], [2], etc. and action_type values from the available actions.`;

      const result = await structuredLlm.invoke(
        [
          { role: "system", content: INSIGHTS_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        config
      );

      // Extract intents from wrapper and validate
      const intentsResult = result as z.infer<typeof insightsIntentOutputSchema>;
      validateInsightIntents(intentsResult.insights, validatedInput);

      // Resolve intents to full insights with URLs
      const insights = resolveInsights(intentsResult.insights, validatedInput.projects);

      return {
        insights,
        generationError: undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error generating insights";
      console.error("Error generating insights:", errorMessage);

      return {
        generationError: errorMessage,
        insights: [],
      };
    }
  }
);
