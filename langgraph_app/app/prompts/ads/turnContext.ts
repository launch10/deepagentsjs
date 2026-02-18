import { type BaseMessage, HumanMessage } from "@langchain/core/messages";
import { type LangGraphRunnableConfig, Ads } from "@types";
import { type AdsGraphState } from "@state";
import { getAssetPrompts, getOutputPrompt } from "./assets/assets/builder";
import { createContextMessage, isContextMessage } from "langgraph-ai-sdk";

export const PAGE_NAMES: Record<Ads.StageName, string> = {
  content: "the headlines and descriptions page",
  highlights: "the callouts and structured snippets page",
  keywords: "the keywords page",
  settings: "the campaign settings page",
  launch: "the review page",
  review: "the review page",
};

const STAGE_ASSETS: Partial<Record<Ads.StageName, string>> = {
  content: "headlines and descriptions",
  highlights: "callouts and structured snippets",
  keywords: "keywords",
};

/**
 * Build a per-turn context message for the ads agent.
 *
 * Always returns at least a minimal page-awareness context so the
 * agent knows which page the user is on — even on user-message turns.
 *
 * For intent-driven turns (no user message), returns a rich context
 * with asset instructions, output format, and preferences.
 */
export const buildTurnContext = async (
  state: AdsGraphState,
  config: LangGraphRunnableConfig
): Promise<BaseMessage | null> => {
  const stage = state.stage as Ads.StageName;
  if (!stage) return null;

  const lastMsg = state.messages?.at(-1);
  const hasUserMessage =
    lastMsg && HumanMessage.isInstance(lastMsg) && !isContextMessage(lastMsg);

  // Content stages without a user message: full asset generation context
  if (Ads.isContentStage(stage) && !hasUserMessage) {
    return buildAssetContext(state, config);
  }

  // All other cases: minimal page awareness so the agent knows where we are
  return createContextMessage(`The user is on ${PAGE_NAMES[stage]}.`);
};

/**
 * Build rich context for content stages (headlines, callouts, keywords).
 * Only called for intent-driven turns (no user message).
 */
async function buildAssetContext(
  state: AdsGraphState,
  config: LangGraphRunnableConfig
): Promise<BaseMessage | null> {
  const stage = state.stage as Ads.StageName;
  const isRefresh = !!state.refresh?.length;
  const [assetInstructions, outputFormat] = await Promise.all([
    getAssetPrompts(state, config),
    getOutputPrompt(state, config),
  ]);
  const prefs = buildPreferencesContext(state);

  const parts: string[] = [];

  // 1. Conversational opening
  if (isRefresh) {
    if (prefs) parts.push(prefs);
    const assetRequests = state
      .refresh!.map((r) => `${r.nVariants} fresh ${r.asset}`)
      .join(" and ");
    parts.push(`Give me ${assetRequests}.`);
  } else {
    parts.push(`I'm on ${PAGE_NAMES[stage]}. Generate my ${STAGE_ASSETS[stage]}.`);
    if (prefs) parts.push(prefs);
  }

  // 2. Asset instructions (char limits, guidelines)
  parts.push(assetInstructions);

  // 3. Output format (JSON example for this stage)
  parts.push(outputFormat);

  // 4. Response framing
  if (isRefresh) {
    parts.push("Keep the intro brief — one sentence, then the JSON block.");
  }

  return createContextMessage(parts.join("\n\n"));
}

/**
 * Conversational framing of locked/rejected assets.
 */
export function buildPreferencesContext(state: AdsGraphState): string | null {
  const stage = state.stage as Ads.StageName;
  const stageConfig = Ads.Stages[stage];
  if (!stageConfig) return null;

  const lines: string[] = [];
  for (const assetKind of stageConfig.assets) {
    const assets =
      assetKind === "structuredSnippets"
        ? state.structuredSnippets?.details
        : (state[assetKind] as Ads.Asset[] | undefined);
    if (!assets?.length) continue;

    const liked = assets.filter((a) => a.locked);
    const rejected = assets.filter((a) => a.rejected);

    if (liked.length) {
      lines.push(
        `I liked these ${assetKind}: ${liked.map((a) => `"${a.text}"`).join(", ")}.`
      );
    }
    if (rejected.length) {
      lines.push(
        `Skip anything like: ${rejected.map((a) => `"${a.text}"`).join(", ")}.`
      );
    }
  }
  return lines.length > 0 ? lines.join(" ") : null;
}
