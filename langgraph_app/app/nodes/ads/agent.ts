import { createAgent, createMiddleware } from "langchain";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { getLLM } from "@core";
import { chooseAdsPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { saveAnswersTool, finishedTool } from "@tools";
import { type AdsGraphState } from "@state";
import z from "zod";
import { toStructuredMessage } from "langgraph-ai-sdk";
import { lastAIMessage, Ads } from "@types";

const dynamicPromptMiddleware = createMiddleware({
    name: "DynamicPromptMiddleware",
    stateSchema: z.object({
        projectUUID: z.string(),
        websiteId: z.number(),
        brainstorm: z.any(),    
        stage: z.string(),
        headlines: z.array(Ads.AssetSchema),
        descriptions: z.array(Ads.AssetSchema),
        uniqueFeatures: z.array(Ads.AssetSchema),
        structuredSnippets: z.array(Ads.AssetSchema),
        keywords: z.array(Ads.AssetSchema),
        availableCommands: z.array(z.string()),
        command: z.string(),
        redirect: z.string(),
    }).partial(),
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

    const stateWithMessages = {
        ...state,
        messages: state.messages?.length 
            ? state.messages 
            : [new HumanMessage("Begin")]
    };

    const result = await agent.invoke(stateWithMessages as any, config) as unknown as AdsGraphState;
    const lastMessage = lastAIMessage(result);
    if (!lastMessage) {
        throw new Error("Agent did not return an AI message");
    }

    const structuredMessage = await toStructuredMessage(lastMessage);
    const adsData = structuredMessage?.response_metadata?.parsed_blocks?.[0]?.parsed;
    let messages = state.messages || [];
    if (structuredMessage) {
        messages = [...(messages as any[]), structuredMessage];
    }

    const dataSchema = z.object({
        headlines: z.array(z.string()),
        descriptions: z.array(z.string()),
    });

    // Validate the parsed data
    const validationResult = dataSchema.safeParse(adsData);
    if (!validationResult.success) {
        console.error("Validation failed:", validationResult.error);
    }
    // Keep locked headlines and rejected, add up to X new ones (based on data type)
    const stateData = Object.entries(validationResult.success ? validationResult.data : {}).reduce((acc, [key, value]) => {
        if (Array.isArray(value)) {
            acc[key] = value.map((text: string) => ({
                text,
                rejected: false,
                locked: false
            } as Ads.Asset));
        }
        return acc;
    }, {} as Record<string, any>);

    return {
        messages,
        ...stateData,
    };
});