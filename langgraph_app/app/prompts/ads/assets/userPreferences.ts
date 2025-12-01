
import { type AdsGraphState } from "@state";
import { Ads } from "@types";

export const userPreferencesPrompt = async (state: AdsGraphState, asset: Ads.AssetKind) => {
    let assets: Ads.Asset[] | undefined;

    if (asset === "structuredSnippets") {
        const snippet = state.structuredSnippets;
        assets = snippet ? snippet.details satisfies Ads.Asset[] : undefined;
    } else {
        assets = (state[asset] || []) satisfies Ads.Asset[];
    }
    const likedAssets = assets?.filter((a: any) => a.locked) || [];
    const rejectedAssets = assets?.filter((a: any) => a.rejected) || [];
    const provideBackground = likedAssets.length > 0 || rejectedAssets.length > 0;

    return `
        ${
            provideBackground 
                ? `User's preferences. Understand what the user likes and dislikes about the ${asset}, and adapt your approach accordingly:\n` +
                    (likedAssets ? `Liked ${asset}:\n${likedAssets.map((a: any, i: number) => `${i+1}. ${a.text}`).join('\n')}\n` : '') +
                    (rejectedAssets ? `Rejected ${asset} (avoid these patterns):\n${rejectedAssets.map((a: any, i: number) => `${i+1}. ${a.text}`).join('\n')}\n` : '')
                : ''
        }

        ${provideBackground ? `Always generate net-new, unique ${asset} (do not repeat ones user previously liked or rejected).` : ''}
    `;
}