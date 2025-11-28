import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getFAQContext } from "@prompts";

export const adsFaqTool = tool(
    async () => {
        return getFAQContext();
    },
    {
        name: "ads_faq",
        description: `
            Use this tool when the user is asking questions about Google Ads, how the ad builder works,
            or seeking clarification about headlines, descriptions, callouts, structured snippets, or keywords.
            
            This tool returns FAQ content that you can use to answer the user's question.
            When using this tool, respond conversationally with just text - do NOT include any JSON or structured data.
        `,
        schema: z.object({}),
    }
);
