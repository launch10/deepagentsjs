import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { NodeMiddleware } from "@middleware";
import { Insights } from "@types";
import { type InsightsGraphState } from "@annotation";

/**
 * System prompt for generating analytics insights
 */
const INSIGHTS_SYSTEM_PROMPT = `You are an expert marketing analyst helping someone validate their business idea.

Given the metrics below, generate exactly 3 insights that will help them improve.

RULES:
1. At least 1 insight MUST be positive (celebrate wins, even small ones)
2. Every insight must include a specific action they can take
3. Be specific: name projects, cite numbers, compare to previous periods
4. Prioritize by urgency: problems first, then opportunities
5. If a project has no leads for 7+ days, always flag it (days_since_last_lead)
6. Keep titles short (5 words max)
7. Include concrete numbers in descriptions

INSIGHT CATEGORIES (use these to guide your thinking):
- Lead Health: lead velocity, stalled projects, first leads
- Cost Efficiency: CPL trends, ROAS, expensive leads warnings
- Momentum: CTR trends, traffic changes, peak performance
- Project Comparison: winners vs underperformers

ACTIONS AVAILABLE (use the project's UUID in URLs):
- Review ad copy: /projects/[uuid]/campaigns/content
- Review landing page: /projects/[uuid]/website
- Adjust targeting: /projects/[uuid]/campaigns/targeting
- Adjust budget: /projects/[uuid]/campaigns/budget
- View project: /projects/[uuid]
- View analytics: /projects/[uuid]/analytics

SENTIMENT GUIDANCE:
- "positive": Good news, wins, improvements, milestones
- "negative": Problems, warnings, urgent issues
- "neutral": Observations, suggestions, informational

Remember: Even when metrics look bad, find something constructive. Your goal is to motivate action, not discourage.`;

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
