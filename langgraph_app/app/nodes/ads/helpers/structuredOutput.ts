import { Ads } from "@types";
import { AIMessage } from "@langchain/core/messages";
import { type AdsGraphState } from "@state";

const isAssetKind = (value: unknown): value is Ads.AssetKind => {
    return typeof value === 'string' && Ads.AssetKinds.includes(value as Ads.AssetKind);
};

type RawAIOutput = {
    headlines?: string[];
    descriptions?: string[];
    callouts?: string[];
    keywords?: string[];
    structuredSnippets?: { category?: string; details?: string[] };
};

// Core helper to extract structured data from the last agent message.
// In this workflow, the agent replies with a message + headlines, descriptions, keywords, etc.
// This function extracts that data and returns it as a structured object.
//
// It also determines: Was the last HumanMessage a request to regenerate content? If so,
// we should mark the previous assets as rejected.
export const getStructuredData = (state: AdsGraphState, lastMessage: AIMessage) => {
    const rawData = ((lastMessage.response_metadata?.parsed_blocks as any[] || []).filter((block: any) => block.type === 'structured').map((block: any) => block.parsed).at(-1) || {}) as RawAIOutput;

    const allowedKeys = (state.refresh?.asset ? [state.refresh.asset] : Ads.AssetKinds) as Ads.AssetKind[];

    const structuredData = allowedKeys.reduce((acc, key) => {
        if (!isAssetKind(key)) return acc;
        const value = rawData[key];
        if (value === undefined) return acc;

        if (key === 'structuredSnippets') {
            const snippetValue = value as { category?: string; details?: string[] };
            acc.structuredSnippets = {
                category: {
                    text: snippetValue.category ?? '',
                    rejected: state.structuredSnippets?.category?.rejected || false,
                    locked: state.structuredSnippets?.category?.locked || false
                },
                details: mergeStructuredSnippets(
                    state.structuredSnippets,
                    snippetValue
                ).details
            };
        } else if (Array.isArray(value)) {
            const existingAssets = state[key] || [];
            acc[key] = mergeStructuredOutput(
                existingAssets as Ads.Asset[], 
                value as string[]
            );
        }
        return acc;
    }, {} as Partial<AdsGraphState>);

    return applyImplicitRefresh(state, structuredData);
}

const mergeStructuredOutput = (
    existing: Ads.Asset[],
    incoming: string[]
): Ads.Asset[] => {
    const result: Ads.Asset[] = [...existing];
    const existingAssets = new Set(existing.map(asset => asset.text));
    
    for (const text of incoming) {
        if (existingAssets.has(text)) {
            continue;
        }
        result.push({
            text,
            rejected: false,
            locked: false
        });
    }

    return result;
};

const applyImplicitRefresh = (
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
    incoming: { category?: string; details?: string[] }
): Ads.StructuredSnippets => {
    const category: Ads.Asset = existing?.category ?? {
        text: incoming.category || "Types",
        rejected: false,
        locked: false
    };
    
    if (incoming.category && incoming.category !== existing?.category?.text) {
        category.text = incoming.category;
    }

    const existingDetails = existing?.details || [];
    const existingTexts = new Set(existingDetails.map(d => d.text));
    const newDetails: Ads.Asset[] = [...existingDetails];

    for (const detail of incoming.details || []) {
        if (!existingTexts.has(detail)) {
            newDetails.push({
                text: detail,
                rejected: false,
                locked: false
            });
        }
    }

    return { category, details: newDetails };
};
