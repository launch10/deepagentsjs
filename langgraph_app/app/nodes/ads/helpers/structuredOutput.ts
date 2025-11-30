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

    return structuredData;
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
