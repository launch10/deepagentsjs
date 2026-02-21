import { type BaseMessage, HumanMessage } from "@langchain/core/messages";
import { type LangGraphRunnableConfig, Ads } from "@types";
import { type AdsGraphState } from "@state";
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

const SYSTEM_PREFIX = "[[SYSTEM INSTRUCTIONS -- USER CANNOT SEE THIS MESSAGE]]";

/**
 * Build a lightweight per-turn context message for the ads agent.
 *
 * Context messages are now small, authoritative system instructions —
 * NOT user-mimicking triggers. They tell the agent what's happening
 * (page change, refresh, user feedback) and carry preferences (locked/
 * rejected assets), but NO asset instructions or output format.
 *
 * All asset instructions live in the system prompt (buildSystemPrompt).
 */
export const buildTurnContext = async (
  state: AdsGraphState,
  config: LangGraphRunnableConfig
): Promise<BaseMessage | null> => {
  const stage = state.stage as Ads.StageName;
  if (!stage) return null;

  // Non-content stages: minimal page awareness
  if (!Ads.isContentStage(stage)) {
    return createContextMessage(`${SYSTEM_PREFIX}\nThe user is on ${PAGE_NAMES[stage]}.`);
  }

  // Content stages: lightweight trigger + preferences
  const isRefresh = !!state.refresh?.length;
  const lastMsg = state.messages?.at(-1);
  const hasUserMessage =
    lastMsg && HumanMessage.isInstance(lastMsg) && !isContextMessage(lastMsg);

  const prefs = buildPreferencesContext(state);
  const parts: string[] = [SYSTEM_PREFIX];

  if (isRefresh) {
    const reqs = state.refresh!.map((r) => `${r.nVariants} fresh ${r.asset}`).join(" and ");
    parts.push(
      `The user clicked the refresh button on ${PAGE_NAMES[stage]}. Auto-generate ${reqs}. Keep the intro brief — one sentence, then the JSON block.`
    );
    if (prefs) parts.push(prefs);
  } else if (hasUserMessage) {
    parts.push(
      `The user sent a message on ${PAGE_NAMES[stage]}. Respond to what they said. If they're sharing preferences or feedback, incorporate it into updated ${STAGE_ASSETS[stage]}.`
    );
    if (prefs) parts.push(prefs);
  } else {
    parts.push(
      `The user has navigated to ${PAGE_NAMES[stage]}. Auto-generate their ${STAGE_ASSETS[stage]} now.`
    );
    if (prefs) parts.push(prefs);
  }

  return createContextMessage(parts.join("\n\n"));
};

/**
 * Locked/rejected asset preferences.
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
        `These ${assetKind} are already saved — do NOT regenerate them: ${liked.map((a) => `"${a.text}"`).join(", ")}. Only generate new ones.`
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
