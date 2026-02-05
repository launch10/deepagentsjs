import { createAgent, createMiddleware } from "langchain";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM, createPromptCachingMiddleware } from "@core";
import { chooseAdsPrompt, injectAdsContextMessage } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { type AdsGraphState } from "@state";
import z from "zod";
import { lastAIMessage, Ads } from "@types";
import { getTools } from "./helpers/index";
import { AdsBridge } from "@annotation";

const dynamicPromptMiddleware = createMiddleware({
  name: "DynamicPromptMiddleware",
  stateSchema: z
    .object({
      projectUUID: z.string(),
      websiteId: z.number(),
      brainstorm: z.any(),
      stage: z.string(),
      refresh: Ads.RefreshCommandSchema.optional(),
      headlines: z.array(Ads.AssetSchema),
      descriptions: z.array(Ads.AssetSchema),
      uniqueFeatures: z.array(Ads.AssetSchema),
      structuredSnippets: Ads.StructuredSnippetsSchema.optional(),
      keywords: z.array(Ads.AssetSchema),
      availableCommands: z.array(z.string()),
      command: z.string(),
      redirect: z.string(),
    })
    .partial(),
  wrapModelCall: async (request, handler) => {
    const state = request.state as unknown as AdsGraphState;

    const systemPrompt = await chooseAdsPrompt(state, request.runtime as LangGraphRunnableConfig);

    return await handler({
      ...request,
      systemPrompt,
    });
  },
});

export const adsAgent = NodeMiddleware.use(
  {},
  async (
    state: AdsGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<AdsGraphState>> => {
    const llm = (await getLLM({})).withConfig({ tags: ["notify"] });
    const tools = getTools(state);

    const agent = await createAgent({
      model: llm,
      tools,
      middleware: [createPromptCachingMiddleware(), dynamicPromptMiddleware],
    });

    const stateWithMessages = {
      ...state,
      messages: injectAdsContextMessage(state),
    };

    const result = (await agent.invoke(
      stateWithMessages as any,
      config
    )) as unknown as AdsGraphState;
    const lastMessage = lastAIMessage(result);
    if (!lastMessage) {
      throw new Error("Agent did not return an AI message");
    }
    const [message, updates] = await AdsBridge.toStructuredMessage(lastMessage);
    const mergedAssets = Ads.removeRejected(Ads.mergeStructuredData(state, updates!));

    // Context messages are preserved in state for tracing/analytics.
    // They are filtered at the SDK presentation layer.
    const allMessages = result.messages.slice(0, -1).concat([message]) as BaseMessage[];

    return {
      ...mergedAssets,
      messages: allMessages,
      previousStage: state.stage,
    };
  }
);
