import { createAgent } from "langchain";
import { type BaseMessage } from "@langchain/core/messages";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM, createPromptCachingMiddleware, getLogger } from "@core";
import { buildSystemPrompt } from "@prompts";
import { Conversation } from "@conversation";
import { NodeMiddleware } from "@middleware";
import { type AdsGraphState } from "@state";
import { lastAIMessage, Ads } from "@types";
import { getTools } from "./helpers/index";
import { AdsBridge } from "@annotation";

export const adsAgent = NodeMiddleware.use(
  {},
  async (
    state: AdsGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<AdsGraphState>> => {
    const llm = (await getLLM({})).withConfig({ tags: ["notify"] });
    const tools = getTools(state);

    // 1. Stable system prompt — same string every turn, fully cached
    const systemPrompt = buildSystemPrompt(state);

    // 2. Create agent — systemPrompt passed directly, no dynamic middleware
    const agent = await createAgent({
      model: llm,
      tools,
      systemPrompt,
      middleware: [createPromptCachingMiddleware()],
    });

    // 3. Window messages — context already committed by prepareContext node
    const windowedMessages = new Conversation(state.messages || []).window({
      maxTurnPairs: 10,
      maxChars: 40_000,
    });

    const stateWithMessages = {
      ...state,
      messages: windowedMessages,
    };

    getLogger().info({ stage: state.stage }, "Running ads agent");
    getLogger().info({ messages: windowedMessages }, "Windowed messages");
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

    const allMessages = result.messages.slice(0, -1).concat([message]) as BaseMessage[];

    return {
      ...mergedAssets,
      messages: allMessages,
    };
  }
);
