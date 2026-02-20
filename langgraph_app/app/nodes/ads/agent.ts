import { createAgent } from "langchain";
import { type BaseMessage } from "@langchain/core/messages";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM, getLogger } from "@core";
import { buildSystemPrompt, buildTurnContext } from "@prompts";
import { Conversation } from "@conversation";
import { summarizeMessages } from "@nodes";
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

    // 3. Build turn context for this turn (page-specific ads context)
    const turnContext = await buildTurnContext(state, config!);

    getLogger().info({ stage: state.stage }, "Running ads agent");

    // 4. Run through Conversation.start() — handles prepare, window, compact
    const convResult = await Conversation.start(
      {
        messages: state.messages || [],
        extraContext: turnContext ? [turnContext] : [],
        maxTurnPairs: 4,
        maxChars: 20_000,
        compact: { summarizer: summarizeMessages },
      },
      async (prepared) => {
        const stateWithMessages = { ...state, messages: prepared };
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

        // Slice off input, replace last AI with structured version
        const agentNewMessages = result.messages
          .slice(prepared.length, -1)
          .concat([message]) as BaseMessage[];

        return {
          messages: agentNewMessages,
          ...mergedAssets,
        };
      }
    );

    return {
      ...convResult,
    };
  }
);
