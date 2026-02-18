import { createAgent } from "langchain";
import { type BaseMessage } from "@langchain/core/messages";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM, getLogger } from "@core";
import { buildSystemPrompt, buildTurnContext } from "@prompts";
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

    // 1. Semi-dynamic system prompt — changes per page, stable within page
    //    No prompt caching middleware needed; the system prompt IS the authority
    const systemPrompt = await buildSystemPrompt(state, config!);

    // 2. Create agent — no caching middleware, system prompt carries everything
    const agent = await createAgent({
      model: llm,
      tools,
      systemPrompt,
    });

    // 3. Build turn context and pass through prepareTurn() so it's placed
    //    correctly (CTX before HUMAN). Same pattern as coding/brainstorm agents.
    const turnContext = await buildTurnContext(state, config!);
    const contextMessages = turnContext ? [turnContext] : [];

    const windowedMessages = new Conversation(state.messages || []).prepareTurn({
      contextMessages,
      maxTurnPairs: 4,
      maxChars: 20_000,
    });

    const stateWithMessages = {
      ...state,
      messages: windowedMessages,
    };

    getLogger().info({ stage: state.stage }, "Running ads agent");
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
