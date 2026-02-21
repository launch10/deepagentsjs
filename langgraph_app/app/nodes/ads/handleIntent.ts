import { NodeMiddleware } from "@middleware";
import type { AdsGraphState } from "@state";
import { isSwitchPageIntent, isRefreshAssetsIntent, type Ads } from "@types";

/**
 * handleIntent — first node in the ads graph.
 *
 * Pure state derivation. No message injection.
 * Context messages are the agent's responsibility (via turnContext).
 *
 * 1. Process formal intents (switch_page, refresh_assets) → derive state updates
 * 2. Clear the intent so it's not re-processed
 * 3. Set previousStage so guardrails can detect re-visits
 */
export const handleIntentNode = NodeMiddleware.use(
  {},
  async (state: AdsGraphState): Promise<Partial<AdsGraphState>> => {
    const updates: Partial<AdsGraphState> = {
      intent: null, // Always clear after processing
      error: undefined, // Clear stale errors from previous turns (was in old prepareNode)
    };

    const intent = state.intent;

    if (intent && isSwitchPageIntent(intent)) {
      updates.stage = intent.payload.stage as Ads.StageName;
    }

    if (intent && isRefreshAssetsIntent(intent)) {
      updates.stage = intent.payload.stage as Ads.StageName;
      updates.refresh = intent.payload.assets as Ads.RefreshCommand;
    }

    // Set previousStage so guardrails can detect re-visits
    const effectiveStage = updates.stage ?? state.stage;
    if (effectiveStage) {
      updates.previousStage = effectiveStage;
    }

    return updates;
  }
);
