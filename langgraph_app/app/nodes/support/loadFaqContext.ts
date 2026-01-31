import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { type SupportGraphState } from "@annotation";
import { db, faqs, eq, asc } from "@db";

/**
 * Node that loads published FAQs from the database and formats them
 * as structured text for injection into the support agent's system prompt.
 */
export const loadFaqContext = NodeMiddleware.use(
  {},
  async (
    state: SupportGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<SupportGraphState>> => {
    // If FAQ context is already loaded (e.g., from a previous turn), skip
    if (state.faqContext) {
      return {};
    }

    try {
      const rows = await db
        .select({
          question: faqs.question,
          answer: faqs.answer,
          category: faqs.category,
          subcategory: faqs.subcategory,
        })
        .from(faqs)
        .where(eq(faqs.published, true))
        .orderBy(asc(faqs.category), asc(faqs.position));

      if (rows.length === 0) {
        return {
          faqContext: "No FAQ content is currently available.",
        };
      }

      // Group by category then subcategory for structured output
      let currentCategory = "";
      let currentSubcategory = "";
      const lines: string[] = [];

      for (const row of rows) {
        if (row.category !== currentCategory) {
          currentCategory = row.category;
          currentSubcategory = "";
          lines.push(`\n## ${formatCategory(row.category)}\n`);
        }

        if (row.subcategory && row.subcategory !== currentSubcategory) {
          currentSubcategory = row.subcategory;
          lines.push(`\n### ${row.subcategory}\n`);
        }

        lines.push(`**Q: ${row.question}**`);
        lines.push(`${row.answer}\n`);
      }

      return {
        faqContext: lines.join("\n"),
      };
    } catch (error) {
      console.error("[loadFaqContext] Failed to load FAQs:", error);
      return {
        faqContext: "FAQ content could not be loaded at this time.",
      };
    }
  }
);

function formatCategory(category: string): string {
  const labels: Record<string, string> = {
    getting_started: "Getting Started",
    credits_billing: "Credits & Billing",
    landing_pages: "Landing Pages",
    google_ads: "Google Ads",
    account: "Account",
  };
  return labels[category] || category;
}
