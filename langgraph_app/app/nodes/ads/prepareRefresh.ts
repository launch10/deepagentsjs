import { NodeMiddleware } from "@middleware";
import type { AdsGraphState } from "@state";
import { Ads } from "@types";

export const prepareRefreshNode = NodeMiddleware.use({}, async (state: AdsGraphState, config?: any) => {
    if (!state.refresh) {
        return {};
    }

    const assetKey = state.refresh.asset;
    const result: Partial<AdsGraphState> = {};

    if (assetKey === "structuredSnippets") {
        if (state.structuredSnippets?.details) {
            result.structuredSnippets = {
                category: state.structuredSnippets.category,
                details: state.structuredSnippets.details.map(asset => ({
                    ...asset,
                    rejected: asset.locked ? asset.rejected : true
                }))
            };
        }
    } else {
        const existingAssets = state[assetKey] as Ads.Asset[] | undefined;
        if (existingAssets) {
            result[assetKey] = existingAssets.map(asset => ({
                ...asset,
                rejected: asset.locked ? asset.rejected : true
            })) as any;
        }
    }

    return result;
});
