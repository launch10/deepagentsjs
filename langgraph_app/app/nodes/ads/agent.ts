import { createAgent, createMiddleware } from "langchain";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { chooseAdsPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { saveAnswersTool, finishedTool } from "@tools";
import { type AdsGraphState } from "@state";
import z from "zod";
import { toStructuredMessage } from "langgraph-ai-sdk";
import { lastAIMessage } from "@types";
import { Ads } from "@types";

const dynamicPromptMiddleware = createMiddleware({
    name: "DynamicPromptMiddleware",
    stateSchema: z.object({
        projectUUID: z.string(),
        headlines: z.array(Ads.AssetSchema).optional(),
        descriptions: z.array(Ads.AssetSchema).optional(),
        uniqueFeatures: z.array(Ads.AssetSchema).optional(),
        structuredSnippets: z.array(Ads.AssetSchema).optional(),
        keywords: z.array(Ads.AssetSchema).optional(),
        availableCommands: z.array(z.string()),
        command: z.string().optional(),
        redirect: z.string().optional(),
    }),
    wrapModelCall: async (request, handler) => {
        const state = request.state as unknown as AdsGraphState;

        // Regenerate system prompt with current state
        const systemPrompt = await chooseAdsPrompt(state, request.runtime);

        // Return modified request
        const result = await handler({
            ...request,
            systemPrompt,
        });

        return await toStructuredMessage(result as any) as any;
    },
})

/**
 * Node that generates ads content
 */
export const adsAgent = NodeMiddleware.use({}, async (
    state: AdsGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<AdsGraphState>> => {
    const llm = getLLM().withConfig({ tags: ['notify'] })
    const tools = [saveAnswersTool, finishedTool];

    const agent = await createAgent({
        model: llm,
        tools,
        middleware: [dynamicPromptMiddleware],
    });
    const result = await agent.invoke(state as any, config) as unknown as AdsGraphState;
    const lastMessage = lastAIMessage(result);
    if (!lastMessage) {
        throw new Error("Agent did not return an AI message");
    }

    const structuredMessage = await toStructuredMessage(lastMessage as any);
    let messages = state.messages || [];
    if (structuredMessage) {
        messages = [...(messages as any[]), structuredMessage];
    }

    return {
        messages,
    };
});