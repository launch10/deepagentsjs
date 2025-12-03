import { Ads } from "@types";
import { type AdsGraphState } from "@state";

const isAssetKind = (value: unknown): value is Ads.AssetKind => {
    return typeof value === 'string' && Ads.AssetKinds.includes(value as Ads.AssetKind);
};

export const getStructuredData = (state: AdsGraphState, updates: Partial<Ads.Assets> | undefined): Partial<AdsGraphState> => {
    if (!updates) {
        return {};
    }
    const allowedKeys = (state.refresh?.asset ? [state.refresh.asset] : Ads.AssetKinds) as Ads.AssetKind[];

    const structuredData = allowedKeys.reduce((acc, key) => {
        if (!isAssetKind(key)) return acc;
        const value = updates[key];
        if (value === undefined) return acc;

        if (key === 'structuredSnippets') {
            const incomingSnippets = value as Ads.StructuredSnippets;
            acc.structuredSnippets = mergeStructuredSnippets(
                state.structuredSnippets,
                incomingSnippets
            );
        } else {
            const existingAssets = state[key] || [];
            const incomingAssets = value as Ads.Asset[];
            acc[key] = mergeAssets(existingAssets as Ads.Asset[], incomingAssets);
        }
        return acc;
    }, {} as Partial<AdsGraphState>);

    return applyHumanRefresh(state, structuredData);
}

const mergeAssets = (
    existing: Ads.Asset[],
    incoming: Ads.Asset[]
): Ads.Asset[] => {
    const result: Ads.Asset[] = [...existing];
    const existingTexts = new Set(existing.map(asset => asset.text));
    
    for (const asset of incoming) {
        if (existingTexts.has(asset.text)) {
            continue;
        }
        result.push(asset);
    }

    return result;
};

// If human asked for a refresh, we'll only recognize that after the LLM has already
// interpreted the human message. This is different from the user clicking the refresh
// button, which generates { refresh: { asset: "headlines" } } -- for example
const applyHumanRefresh = (
    originalState: AdsGraphState,
    structuredData: Partial<AdsGraphState>
): Partial<AdsGraphState> => {
    if (originalState.refresh) {
        return structuredData;
    }

    const result = { ...structuredData };

    for (const key of Ads.AssetKinds) {
        if (key === 'structuredSnippets') {
            const originalDetails = originalState.structuredSnippets?.details || [];
            const newDetails = structuredData.structuredSnippets?.details || [];
            
            if (originalDetails.length > 0 && newDetails.length > originalDetails.length) {
                const originalTexts = new Set(originalDetails.map(d => d.text));
                const hasNewAssets = newDetails.some(d => !originalTexts.has(d.text));
                
                if (hasNewAssets && result.structuredSnippets) {
                    result.structuredSnippets = {
                        ...result.structuredSnippets,
                        details: newDetails.map(asset => {
                            if (originalTexts.has(asset.text) && !asset.locked) {
                                return { ...asset, rejected: true };
                            }
                            return asset;
                        })
                    };
                }
            }
        } else {
            const originalAssets = originalState[key] as Ads.Asset[] | undefined;
            const newAssets = structuredData[key] as Ads.Asset[] | undefined;
            
            if (originalAssets && originalAssets.length > 0 && newAssets && newAssets.length > originalAssets.length) {
                const originalTexts = new Set(originalAssets.map(a => a.text));
                const hasNewAssets = newAssets.some(a => !originalTexts.has(a.text));
                
                if (hasNewAssets) {
                    (result as any)[key] = newAssets.map(asset => {
                        if (originalTexts.has(asset.text) && !asset.locked) {
                            return { ...asset, rejected: true };
                        }
                        return asset;
                    });
                }
            }
        }
    }

    return result;
};

const mergeStructuredSnippets = (
    existing: Ads.StructuredSnippets | undefined,
    incoming: Ads.StructuredSnippets
): Ads.StructuredSnippets => {
    const category = incoming.category || existing?.category || "";

    const existingDetails = existing?.details || [];
    const existingTexts = new Set(existingDetails.map(d => d.text));
    const newDetails: Ads.Asset[] = [...existingDetails];

    for (const detail of incoming.details || []) {
        if (!existingTexts.has(detail.text)) {
            newDetails.push(detail);
        }
    }

    return { category, details: newDetails };
};
