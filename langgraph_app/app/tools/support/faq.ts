import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getFAQSearchService } from "@services";

export const supportFaqTool = tool(
  async ({ query }) => {
    const faqService = getFAQSearchService();
    const results = await faqService.search(query, {
      topK: 5,
      status: "live",
      rerankThreshold: 0.15,
    });
    const context = faqService.formatResultsAsContext(results);
    return context;
  },
  {
    name: "faq",
    description: `
            Use this tool to search the FAQ database when the user asks a question about Launch10, how things work, billing, credits, landing pages, Google Ads, or their account.

            This tool returns relevant Q&A pairs to help answer the user's question. When using this tool, respond conversationally with just text - do NOT include any JSON or structured data.
        `,
    schema: z.object({
      query: z.string().describe("The user's question or search query"),
    }),
  }
);
