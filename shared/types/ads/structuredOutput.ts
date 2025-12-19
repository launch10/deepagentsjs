import * as Ads from "./assets";
import { type AdsGraphState } from "../../state";
import type { Simplify } from "type-fest";
import { generateUUID, } from "../core";
import { uniqBy } from "../../helpers"

const isAssetKind = (value: unknown): value is Ads.AssetKind => {
  return typeof value === "string" && Ads.AssetKinds.includes(value as Ads.AssetKind);
};

const toAsset = (text: string): Ads.Asset => (
  { id: generateUUID(), text, rejected: false, locked: false }
);
const toAssets = (texts: string[]): Ads.Asset[] => texts.map(toAsset);

type StreamedSnippet = { category: string; details: string[] };

export const StreamingTransforms = {
  headlines: toAssets,
  descriptions: toAssets,
  callouts: toAssets,
  keywords: toAssets,
  structuredSnippets: (streamed: StreamedSnippet | undefined): Ads.StructuredSnippets => {
    if (!streamed?.details || !streamed?.category) {
      throw new Error("Didn't receive proper snippet")
    }
    return {
      category: streamed.category as Ads.StructuredSnippetCategoryName,
      details: toAssets(streamed.details)
    }
  },
}

export type TransformsType = {
  [K in keyof typeof StreamingTransforms]: ReturnType<typeof StreamingTransforms[K]>
}

const mergeAssets = <T extends Ads.Asset>(incoming: T[], current: T[] | undefined): T[] => {
  const kept = (current || []).filter((c) => c.locked) // Since we know we're merging, it's now safe to filter out existing headlines that aren't locked
  return uniqBy([...kept, ...incoming], "id");
};

const mergeStructuredSnippets = (
  incoming: Ads.StructuredSnippets,
  current: Ads.StructuredSnippets | undefined,
): Ads.StructuredSnippets => {
  const category = incoming.category || current?.category || "";

  const existingDetails = current?.details || [];
  const existingTexts = new Set(existingDetails.map((d) => d.text));
  const newDetails: Ads.Asset[] = [...existingDetails];

  for (const detail of incoming.details || []) {
    if (!existingTexts.has(detail.text)) {
      newDetails.push(detail);
    }
  }

  return { category, details: newDetails };
};
 
export const MergeReducer = {
  headlines: mergeAssets<Ads.Headline>,
  descriptions: mergeAssets<Ads.Description>,
  callouts: mergeAssets<Ads.Callout>,
  keywords: mergeAssets<Ads.Keyword>,
  structuredSnippets: mergeStructuredSnippets,
}

export const removeRejected = (state: Partial<TransformsType>) => {
  return (Object.keys(state) as (keyof TransformsType)[]).reduce((obj, key) => {
    if (key === "structuredSnippets") {
      obj[key] = state[key]
    } else {
      obj[key] = state[key]?.filter((asset) => !asset.rejected)
    }
    return obj;
  }, {} as Partial<TransformsType>);
}

export const mergeStructuredData = (
  state: AdsGraphState,
  updates: TransformsType
): Simplify<Partial<TransformsType>> => {
  if (!updates) {
    return {};
  }
  const allowedKeys = (
    state.refresh?.length 
      ? state.refresh.map((r) => r.asset)
      : Ads.AssetKinds
  ) as Ads.AssetKind[];

  const structuredData = allowedKeys.reduce((acc, key) => {
    if (!isAssetKind(key)) return acc;
    const value = updates[key];
    if (value === undefined) return acc;

    if (key === "structuredSnippets") {
      const incomingSnippets = value as Ads.StructuredSnippets;
      acc.structuredSnippets = mergeStructuredSnippets(incomingSnippets, state.structuredSnippets);
    } else {
      const existingAssets = state[key] || [];
      const incomingAssets = value as Ads.Asset[];
      acc[key] = mergeAssets(incomingAssets, existingAssets);
    }
    return acc;
  }, {} as Partial<TransformsType>);

  return applyHumanRefresh(state, structuredData);
};

// If human asked for a refresh, we'll only recognize that after the LLM has already
// interpreted the human message. This is different from the user clicking the refresh
// button, which generates { refresh: { asset: "headlines" } } -- for example
const applyHumanRefresh = (
  originalState: AdsGraphState,
  structuredData: Partial<TransformsType>
): Partial<TransformsType> => {
  if (originalState.refresh) {
    return structuredData;
  }

  const result = { ...structuredData };

  for (const key of Ads.AssetKinds) {
    if (key === "structuredSnippets") {
      const originalDetails = originalState.structuredSnippets?.details || [];
      const newDetails = structuredData.structuredSnippets?.details || [];

      if (originalDetails.length > 0 && newDetails.length > originalDetails.length) {
        const originalTexts = new Set(originalDetails.map((d) => d.text));
        const hasNewAssets = newDetails.some((d) => !originalTexts.has(d.text));

        if (hasNewAssets && result.structuredSnippets) {
          result.structuredSnippets = {
            ...result.structuredSnippets,
            details: newDetails.map((detail) => {
              return {
                id: detail.id,
                text: detail.text,
                rejected: false,
                locked: false,
              }
            })
          };
        }
      }
    } else {
      const originalAssets = originalState[key] as Ads.Asset[] | undefined;
      const newAssets = structuredData[key] as Ads.Asset[] | undefined;

      if (
        originalAssets &&
        originalAssets.length > 0 &&
        newAssets &&
        newAssets.length > originalAssets.length
      ) {
        const originalTexts = new Set(originalAssets.map((a) => a.text));
        const hasNewAssets = newAssets.some((a) => !originalTexts.has(a.text));

        if (hasNewAssets) {
          (result as any)[key] = newAssets.map((asset) => {
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
