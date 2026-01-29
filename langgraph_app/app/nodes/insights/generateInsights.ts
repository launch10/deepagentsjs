import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { NodeMiddleware } from "@middleware";
import { Insights } from "@types";
import { type InsightsGraphState } from "@annotation";

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

## ACTIONS AVAILABLE (use project UUID in URLs)

- Review ad copy: /projects/[uuid]/campaigns/content
- Review landing page: /projects/[uuid]/website
- Adjust targeting: /projects/[uuid]/campaigns/targeting
- Adjust budget: /projects/[uuid]/campaigns/budget
- View project: /projects/[uuid]
- View analytics: /projects/[uuid]/analytics

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

  lines.push(`## Period: ${metrics.period || "Last 30 Days"}`);
  lines.push("");

  // Totals
  lines.push("## Account Totals");
  lines.push(`- Leads: ${metrics.totals.leads}`);
  lines.push(`- Page Views: ${metrics.totals.page_views}`);
  if (metrics.totals.ctr_available && metrics.totals.ctr !== null) {
    lines.push(`- CTR: ${metrics.totals.ctr}%`);
  }
  if (metrics.totals.cpl_available && metrics.totals.cpl !== null) {
    lines.push(`- Cost Per Lead: $${metrics.totals.cpl.toFixed(2)}`);
  }
  if (metrics.totals.roas_available && metrics.totals.roas !== null) {
    lines.push(`- ROAS: ${metrics.totals.roas}x`);
  }
  if (
    metrics.totals.total_spend_dollars !== null &&
    metrics.totals.total_spend_dollars !== undefined
  ) {
    lines.push(`- Total Spend: $${metrics.totals.total_spend_dollars.toFixed(2)}`);
  }
  lines.push("");

  // Trends
  lines.push("## Trends");
  if (metrics.trends.leads_trend) {
    lines.push(
      `- Leads: ${metrics.trends.leads_trend.direction} ${metrics.trends.leads_trend.percent}%`
    );
  }
  if (metrics.trends.page_views_trend) {
    lines.push(
      `- Page Views: ${metrics.trends.page_views_trend.direction} ${metrics.trends.page_views_trend.percent}%`
    );
  }
  if (metrics.trends.ctr_trend) {
    lines.push(`- CTR: ${metrics.trends.ctr_trend.direction} ${metrics.trends.ctr_trend.percent}%`);
  }
  if (metrics.trends.cpl_trend) {
    // For CPL, down is good!
    const cplDirection = metrics.trends.cpl_trend.direction;
    const cplNote =
      cplDirection === "down" ? " (improving)" : cplDirection === "up" ? " (worsening)" : "";
    lines.push(`- CPL: ${cplDirection} ${metrics.trends.cpl_trend.percent}%${cplNote}`);
  }
  lines.push("");

  // Projects
  if (metrics.projects.length > 0) {
    lines.push("## Projects");
    for (const project of metrics.projects) {
      lines.push(`### ${project.name} (UUID: ${project.uuid})`);
      lines.push(`- Leads: ${project.total_leads}`);
      lines.push(`- Page Views: ${project.total_page_views}`);
      if (project.ctr !== null) {
        lines.push(`- CTR: ${project.ctr}%`);
      }
      if (project.cpl !== null) {
        lines.push(`- CPL: $${project.cpl.toFixed(2)}`);
      }
      if (project.roas !== null) {
        lines.push(`- ROAS: ${project.roas}x`);
      }
      if (project.spend_dollars !== null && project.spend_dollars !== undefined) {
        lines.push(`- Spend: $${project.spend_dollars.toFixed(2)}`);
      }
      if (project.days_since_last_lead !== null && project.days_since_last_lead !== undefined) {
        lines.push(`- Days Since Last Lead: ${project.days_since_last_lead}`);
        if (project.days_since_last_lead >= 7) {
          lines.push(`  ⚠️ STALLED - No leads in ${project.days_since_last_lead} days!`);
        }
      }
      lines.push("");
    }
  }

  // Flags
  if (metrics.flags) {
    lines.push("## Flags");
    if (metrics.flags.has_stalled_project) {
      lines.push("- ⚠️ Has stalled project(s)");
    }
    if (metrics.flags.has_high_performer) {
      lines.push("- ✅ Has high performer(s)");
    }
    if (metrics.flags.has_new_first_lead) {
      lines.push("- 🎉 Has new first lead!");
    }
  }

  return lines.join("\n");
}

/**
 * Validates that the insights array meets our requirements:
 * - Exactly 3 insights
 * - At least 1 positive when there's something positive to say
 */
function validateInsights(
  insights: Insights.Insight[],
  metrics: Insights.MetricsInput
): Insights.Insight[] {
  // Ensure we have exactly 3
  if (insights.length !== 3) {
    throw new Error(`Expected exactly 3 insights, got ${insights.length}`);
  }

  // Check for at least one positive when warranted
  const hasPositive = insights.some((i) => i.sentiment === "positive");
  const hasGoodMetrics =
    metrics.totals.leads > 0 ||
    metrics.trends.leads_trend?.direction === "up" ||
    metrics.trends.ctr_trend?.direction === "up" ||
    metrics.trends.cpl_trend?.direction === "down"; // down CPL is good

  if (hasGoodMetrics && !hasPositive) {
    // The LLM failed to include a positive - we'll log this but not fail
    console.warn("Insights validation: Expected at least one positive insight given the metrics");
  }

  return insights;
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
      const llm = await getLLM({ skill: "writing", speed: "fast" });
      const structuredLlm = llm.withStructuredOutput(Insights.insightsArraySchema, {
        name: "insights",
      });

      // Generate insights
      const userPrompt = `Here are the metrics to analyze:\n\n${metricsText}\n\nGenerate exactly 3 actionable insights.`;

      const result = await structuredLlm.invoke(
        [
          { role: "system", content: INSIGHTS_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        config
      );

      // Validate the result
      const insights = validateInsights(result as Insights.Insight[], validatedInput);

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
