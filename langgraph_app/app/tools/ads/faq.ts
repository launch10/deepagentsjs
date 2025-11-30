import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getFAQSearchService } from "@services";

export const adsFaqTool = tool(
    async ({ query }) => {
        const faqService = getFAQSearchService();
        const results = await faqService.search(query, {
            topK: 5,
            status: "live",
            rerankThreshold: 0.3,
        });
        const context =  faqService.formatResultsAsContext(results);
        return context;
    },
    {
        name: "faq",
        description: `
            Use this tool when the user is asking questions about Google Ads, how the ad builder works, or seeking clarification about headlines, descriptions, callouts, structured snippets, or keywords.
            
            This tool searches the FAQ database and returns relevant Q&A pairs to help answer the user's question.  When using this tool, respond conversationally with just text - do NOT include any JSON or structured data.
        `,
        schema: z.object({
            query: z.string().describe("The user's question or search query"),
        }),
    }
);
