import { useCallback, useEffect, useRef } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";
import { useCampaignService } from "@api/campaigns.hooks";
import type { UpdateCampaignRequestBody } from "@api/campaigns";
import { mapApiErrorsToForm } from "@helpers/formErrorMapper";
import { useAdsChatState } from "./useAdsChat";
import { useLatestMutation } from "./useLatestMutation";
import type { UpdateCampaignResponse } from "@api/campaigns";

export type UseCampaignAutosaveOptions<TFormData extends FieldValues> = {
  methods: UseFormReturn<TFormData>;
  transformFn: (formData: TFormData) => Partial<UpdateCampaignRequestBody> | null;
  debounceMs?: number;
  onSuccess?: (data: { ready_for_next_stage?: boolean }) => void;
  enabled?: boolean;
};

export type UseCampaignAutosaveReturn = {
  isAutosaving: boolean;
  autosaveError: Error | null;
  saveNow: () => Promise<void>;
};

export function useCampaignAutosave<TFormData extends FieldValues>({
  methods,
  transformFn,
  debounceMs = 750,
  onSuccess,
  enabled,
}: UseCampaignAutosaveOptions<TFormData>): UseCampaignAutosaveReturn {
  const campaignId = useAdsChatState("campaignId");
  const service = useCampaignService();
  const shouldAutosave = enabled ?? !!campaignId;

  const hasMounted = useRef(false);
  const lastSavedValue = useRef<string | null>(null);

  const methodsRef = useRef(methods);
  methodsRef.current = methods;

  const transformFnRef = useRef(transformFn);
  transformFnRef.current = transformFn;

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const campaignIdRef = useRef(campaignId);
  campaignIdRef.current = campaignId;

  const getApiData = useCallback((): Partial<UpdateCampaignRequestBody> | null => {
    const formData = methodsRef.current.getValues() as TFormData;
    const apiData = transformFnRef.current(formData);

    if (!apiData) {
      return null;
    }

    const serialized = JSON.stringify(apiData);
    if (serialized === lastSavedValue.current) {
      return null;
    }

    return apiData;
  }, []);

  const { mutateDebounced, mutateNowAsync, cancel, isPending, error } = useLatestMutation<
    UpdateCampaignResponse,
    void
  >({
    mutationKey: ["campaigns", campaignId, "autosave"],
    mutationFn: async (_: void, signal: AbortSignal) => {
      const currentCampaignId = campaignIdRef.current;
      if (!currentCampaignId) {
        throw new Error("Campaign ID is required for autosave");
      }

      const apiData = getApiData();
      if (!apiData) {
        throw new Error("No data to save");
      }

      lastSavedValue.current = JSON.stringify(apiData);
      return service.update(currentCampaignId, apiData as UpdateCampaignRequestBody, signal);
    },
    debounceMs,
    onSuccess: (data) => {
      onSuccessRef.current?.(data);
    },
    onError: (err) => {
      if (err.message === "No data to save") {
        return;
      }
      mapApiErrorsToForm(err, methodsRef.current);
    },
  });

  useEffect(() => {
    const subscription = methods.watch(() => {
      if (!hasMounted.current) {
        hasMounted.current = true;
        return;
      }

      if (!shouldAutosave || !campaignId) {
        return;
      }

      const apiData = getApiData();
      if (apiData) {
        mutateDebounced();
      } else {
        cancel();
      }
    });

    return () => subscription.unsubscribe();
  }, [methods, shouldAutosave, campaignId, getApiData, mutateDebounced, cancel]);

  const saveNow = useCallback(async () => {
    if (!campaignId) {
      return;
    }

    const apiData = getApiData();
    if (!apiData) {
      return;
    }

    await mutateNowAsync();
  }, [campaignId, getApiData, mutateNowAsync]);

  return {
    isAutosaving: isPending,
    autosaveError: error,
    saveNow,
  };
}
