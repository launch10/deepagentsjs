import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getFAQSearchService } from "@services";

export const adsFaqTool = tool(
    async ({ query, tags }) => {
        const faqService = getFAQSearchService();
        const results = await faqService.search(query, {
            topK: 5,
            tags: tags?.length ? tags : ["ads"],
            status: "live",
            rerankThreshold: 0.3,
        });
        return faqService.formatResultsAsContext(results);
    },
    {
        name: "ads_faq",
        description: `
            Use this tool when the user is asking questions about Google Ads, how the ad builder works,
            or seeking clarification about headlines, descriptions, callouts, structured snippets, or keywords.
            
            This tool searches the FAQ database and returns relevant Q&A pairs to help answer the user's question.
            When using this tool, respond conversationally with just text - do NOT include any JSON or structured data.
        `,
        schema: z.object({
            query: z.string().describe("The user's question or search query"),
            tags: z.array(z.string()).optional().describe("Optional tags to filter results (e.g. ['ads', 'headlines'])"),
        }),
    }
);
