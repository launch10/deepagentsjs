import { useCallback, useEffect, useRef } from "react";
import { useCampaignService } from "@api/campaigns.hooks";
import type { UpdateCampaignRequestBody } from "@api/campaigns";
import { useAdsChatState } from "./useAdsChat";
import { useLatestMutation } from "./useLatestMutation";
import type { UpdateCampaignResponse } from "@api/campaigns";
import { Ads } from "@shared";

type StepName = "content" | "highlights" | "keywords" | "settings" | "launch";

interface StepState {
  headlines?: Ads.Asset[];
  descriptions?: Ads.Asset[];
  callouts?: Ads.Asset[];
  structuredSnippets?: Ads.StructuredSnippets;
  keywords?: Ads.Asset[];
}

// Transform functions for each step - batches all forms on that step
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stepTransforms: Record<StepName, (state: StepState) => Record<string, any> | null> = {
  content: (state) => {
    const headlines = state.headlines
      ?.filter((h: Ads.Asset) => !h.rejected && h.text?.trim())
      .map((h: Ads.Asset) => ({ id: h.id, text: h.text })) ?? [];

    const descriptions = state.descriptions
      ?.filter((d: Ads.Asset) => !d.rejected && d.text?.trim())
      .map((d: Ads.Asset) => ({ id: d.id, text: d.text })) ?? [];

    if (headlines.length === 0 && descriptions.length === 0) return null;

    return {
      ...(headlines.length > 0 ? { headlines } : {}),
      ...(descriptions.length > 0 ? { descriptions } : {}),
    };
  },

  highlights: (state) => {
    const callouts = state.callouts
      ?.filter((c: Ads.Asset) => !c.rejected && c.text?.trim())
      .map((c: Ads.Asset) => ({ id: c.id, text: c.text })) ?? [];

    const snippetCategory = state.structuredSnippets?.category;
    const snippetValues = state.structuredSnippets?.details
      ?.filter((d: Ads.Asset) => !d.rejected && d.text?.trim())
      .map((d: Ads.Asset) => d.text) ?? [];

    if (callouts.length === 0 && (!snippetCategory || snippetValues.length === 0)) return null;

    return {
      ...(callouts.length > 0 ? { callouts } : {}),
      ...(snippetCategory && snippetValues.length > 0 ? {
        structured_snippet: {
          category: snippetCategory,
          values: snippetValues,
        },
      } : {}),
    };
  },

  keywords: (state) => {
    const keywords = state.keywords
      ?.filter((k: Ads.Asset) => !k.rejected && k.text?.trim())
      .map((k: Ads.Asset) => ({ id: k.id, text: k.text, match_type: "broad" })) ?? [];

    if (keywords.length === 0) return null;

    return { keywords };
  },

  settings: () => null, // Settings form handles its own complex transform
  launch: () => null,   // Launch form handles its own complex transform
};

export type UseStepAutosaveOptions = {
  step: StepName;
  debounceMs?: number;
  enabled?: boolean;
};

export type UseStepAutosaveReturn = {
  isAutosaving: boolean;
  autosaveError: Error | null;
  saveNow: () => Promise<void>;
};

export function useStepAutosave({
  step,
  debounceMs = 750,
  enabled,
}: UseStepAutosaveOptions): UseStepAutosaveReturn {
  const campaignId = useAdsChatState("campaignId");
  const service = useCampaignService();
  const shouldAutosave = enabled ?? !!campaignId;

  // Get all relevant state for this step
  const headlines = useAdsChatState("headlines");
  const descriptions = useAdsChatState("descriptions");
  const callouts = useAdsChatState("callouts");
  const structuredSnippets = useAdsChatState("structuredSnippets");
  const keywords = useAdsChatState("keywords");

  const state: StepState = { headlines, descriptions, callouts, structuredSnippets, keywords };

  const hasMounted = useRef(false);
  const lastSavedValue = useRef<string | null>(null);
  const campaignIdRef = useRef(campaignId);
  campaignIdRef.current = campaignId;

  const getApiData = useCallback((): Partial<UpdateCampaignRequestBody> | null => {
    const transform = stepTransforms[step];
    if (!transform) return null;

    const apiData = transform(state);
    if (!apiData) return null;

    const serialized = JSON.stringify(apiData);
    if (serialized === lastSavedValue.current) return null;

    return apiData;
  }, [step, headlines, descriptions, callouts, structuredSnippets, keywords]);

  const { mutateDebounced, mutateNowAsync, cancel, isPending, error } = useLatestMutation<
    UpdateCampaignResponse,
    void
  >({
    mutationKey: ["campaigns", campaignId, "autosave", step],
    mutationFn: async (_: void, signal: AbortSignal) => {
      const currentCampaignId = campaignIdRef.current;
      if (!currentCampaignId) {
        throw new Error("Campaign ID is required for autosave");
      }

      const apiData = getApiData();
      if (!apiData) {
        throw new Error("No data to save");
      }

      const serializedData = JSON.stringify(apiData);
      const result = await service.update(currentCampaignId, apiData as UpdateCampaignRequestBody, signal);
      lastSavedValue.current = serializedData;
      return result;
    },
    debounceMs,
    onError: (err) => {
      if (err.message === "No data to save") return;
      console.error(`[${step}] Autosave error:`, err);
    },
  });

  // Watch for state changes and trigger autosave
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    if (!shouldAutosave || !campaignId) return;

    const apiData = getApiData();
    if (apiData) {
      mutateDebounced();
    } else {
      cancel();
    }
  }, [headlines, descriptions, callouts, structuredSnippets, keywords, shouldAutosave, campaignId, getApiData, mutateDebounced, cancel]);

  const saveNow = useCallback(async () => {
    if (!campaignId) return;

    const apiData = getApiData();
    if (!apiData) return;

    await mutateNowAsync();
  }, [campaignId, getApiData, mutateNowAsync]);

  return {
    isAutosaving: isPending,
    autosaveError: error,
    saveNow,
  };
}
