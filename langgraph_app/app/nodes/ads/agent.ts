import { createAgent, createMiddleware } from "langchain";
import { AIMessage } from "@langchain/core/messages";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM } from "@core";
import { chooseAdsPrompt, injectPseudoMessage, filterPseudoMessages } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { adsFaqTool } from "@tools";
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
      structuredSnippets: Ads.StructuredSnippetsSchema,
      keywords: z.array(Ads.AssetSchema),
      availableCommands: z.array(z.string()),
      command: z.string(),
      redirect: z.string(),
    })
    .partial(),
  wrapModelCall: async (request, handler) => {
    const state = request.state as unknown as AdsGraphState;

    const systemPrompt = await chooseAdsPrompt(state, request.runtime);

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
    const llm = getLLM().withConfig({ tags: ["notify"] });
    const tools = getTools(state);

    const agent = await createAgent({
      model: llm,
      tools,
      middleware: [dynamicPromptMiddleware],
    });

    const stateWithMessages = {
      ...state,
      messages: injectPseudoMessage(state),
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
    const mergedAssets = Ads.removeRejected(
      Ads.mergeStructuredData(state, updates!)
    )

    const allMessages = result.messages.slice(0, -1).concat([message]);
    const filtered = filterPseudoMessages(allMessages);

    return {
      ...mergedAssets,
      messages: filtered,
    };
  }
);