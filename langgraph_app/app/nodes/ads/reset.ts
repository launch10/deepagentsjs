import { NodeMiddleware } from "@middleware";
import type { AdsGraphState } from "@state";
import { CampaignAPIService } from "@services";
import { getLogger } from "@core";

export const resetNode = NodeMiddleware.use({}, async (state: AdsGraphState, config?: any) => {
  // Save current assets to Rails so they persist across page reloads
  if (state.campaignId && state.jwt) {
    const logger = getLogger();
    try {
      const filterActive = (items: { text: string; rejected: boolean }[] | undefined) =>
        (items ?? []).filter((i) => !i.rejected).map((i) => ({ text: i.text }));

      const payload: Record<string, unknown> = {
        headlines: filterActive(state.headlines),
        descriptions: filterActive(state.descriptions),
        keywords: filterActive(state.keywords),
        callouts: filterActive(state.callouts),
      };

      if (state.structuredSnippets) {
        payload.structured_snippet = {
          category: state.structuredSnippets.category,
          values: state.structuredSnippets.details
            .filter((d) => !d.rejected)
            .map((d) => d.text),
        };
      }

      const apiService = new CampaignAPIService({ jwt: state.jwt });
      await apiService.update(state.campaignId, payload as any);
    } catch (err) {
      logger.warn({ err, campaignId: state.campaignId }, "Failed to save ads assets to Rails");
    }
  }

  return {
    refresh: undefined, // reset refresh state
  };
});
