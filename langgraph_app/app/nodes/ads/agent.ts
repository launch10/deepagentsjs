import { createAgent, createMiddleware } from "langchain";
import { AIMessage } from "@langchain/core/messages";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { getLLM } from "@core";
import { chooseAdsPrompt } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { adsFaqTool } from "@tools";
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
        refresh: Ads.RefreshContextSchema.optional(),
        headlines: z.array(Ads.AssetSchema),
        descriptions: z.array(Ads.AssetSchema),
        uniqueFeatures: z.array(Ads.AssetSchema),
        structuredSnippet: Ads.StructuredSnippetSchema,
        keywords: z.array(Ads.AssetSchema),
        availableCommands: z.array(z.string()),
        command: z.string(),
        redirect: z.string(),
    }).partial(),
    wrapModelCall: async (request, handler) => {
        const state = request.state as unknown as AdsGraphState;

        const systemPrompt = await chooseAdsPrompt(state, request.runtime);

        const result = await handler({
            ...request,
            systemPrompt,
        });
        return await toStructuredMessage(result);
    },
});

const mergeStructuredOutput = (
    existing: Ads.Asset[],
    incoming: string[],
): Ads.Asset[] => {
    const result: Ads.Asset[] = [...existing];
    const existingAssets = new Set(existing.map(asset => asset.text));
    let addedCount = 0;
    
    for (const text of incoming) {
        if (existingAssets.has(text)) {
            continue;
        }
        result.push({
            text,
            rejected: false,
            locked: false
        });
        addedCount++;
    }
    
    return result;
};

export const adsAgent = NodeMiddleware.use({}, async (
    state: AdsGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<AdsGraphState>> => {
    const llm = getLLM()
    const tools = [adsFaqTool];

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

    const rawData = ((lastMessage.response_metadata?.parsed_blocks as any[] || []).filter((block: any) => block.type === 'structured').map((block: any) => block.parsed).at(-1) || {}) as Partial<AdsGraphState>;

    const allowedKeys = state.refresh?.asset ? [state.refresh.asset] : Ads.AssetKinds;

    const structuredData = Object.entries(rawData).reduce((acc, [key, value]) => {
        if (Array.isArray(value) && allowedKeys.includes(key as Ads.AssetKind)) {
            (acc as any)[key] = mergeStructuredOutput((state as any)[key] || [], value);
        }
        return acc;
    }, {} as Partial<AdsGraphState>);

    return {
        ...structuredData,
        messages: result.messages,
    };
});
