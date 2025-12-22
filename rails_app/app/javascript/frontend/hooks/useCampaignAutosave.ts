import { useCallback, useEffect, useRef } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";
import { useCampaignService, type CampaignUpdateRequest } from "@api/campaigns.hooks";
import type { UpdateCampaignRequestBody } from "@api/campaigns";
import { mapApiErrorsToForm } from "@helpers/formErrorMapper";
import { useAdsChatState } from "./useAdsChat";
import { useLatestMutation } from "./useLatestMutation";
import type { UpdateCampaignResponse } from "@api/campaigns";
import { buildUpdateRequest, type FieldMapping } from "./campaignAutosave.transforms";

export type { FieldMapping } from "./campaignAutosave.transforms";

type BaseOptions<TFormData extends FieldValues> = {
  methods: UseFormReturn<TFormData>;
  debounceMs?: number;
  onSuccess?: (data: { ready_for_next_stage?: boolean }) => void;
  enabled?: boolean;
};

type AssetMappingOptions<TFormData extends FieldValues> = BaseOptions<TFormData> & {
  fieldMappings: FieldMapping<TFormData>[];
  values: unknown[];
  transformFn?: never;
  watchedValues?: never;
};

type DirectTransformOptions<TFormData extends FieldValues> = BaseOptions<TFormData> & {
  transformFn: (formData: TFormData) => UpdateCampaignRequestBody | null;
  watchedValues: TFormData;
  fieldMappings?: never;
  values?: never;
};

export type UseCampaignAutosaveOptions<TFormData extends FieldValues> =
  | AssetMappingOptions<TFormData>
  | DirectTransformOptions<TFormData>;

export type UseCampaignAutosaveReturn = {
  isAutosaving: boolean;
  autosaveError: Error | null;
  save: () => Promise<void>;
};

function isDirectTransformOptions<TFormData extends FieldValues>(
  options: UseCampaignAutosaveOptions<TFormData>
): options is DirectTransformOptions<TFormData> {
  return "transformFn" in options && options.transformFn !== undefined;
}

export function useCampaignAutosave<TFormData extends FieldValues>(
  options: UseCampaignAutosaveOptions<TFormData>
): UseCampaignAutosaveReturn {
  const { methods, debounceMs = 750, onSuccess, enabled } = options;

  const campaignId = useAdsChatState("campaignId");
  const service = useCampaignService();
  const shouldAutosave = enabled ?? !!campaignId;

  const isInitialMount = useRef(true);
  const lastSavedValue = useRef<string | null>(null);

  const methodsRef = useRef(methods);
  methodsRef.current = methods;

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const { mutate, mutateAsync, flush, isPending, error } = useLatestMutation<
    UpdateCampaignResponse,
    CampaignUpdateRequest
  >({
    mutationKey: ["campaigns", campaignId, "autosave"],
    mutationFn: async (request: CampaignUpdateRequest, signal: AbortSignal) => {
      if (!campaignId) {
        throw new Error("Campaign ID is required for autosave");
      }
      return service.update(campaignId, request.campaign, signal);
    },
    debounceMs,
    onSuccess: (data) => {
      onSuccessRef.current?.(data);
    },
    onError: (err) => {
      mapApiErrorsToForm(err, methodsRef.current);
    },
  });

  const deps = isDirectTransformOptions(options) ? [options.watchedValues] : [options.values];

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!shouldAutosave || !campaignId) {
      return;
    }

    let apiData: UpdateCampaignRequestBody | null;
    const currentOptions = optionsRef.current;

    if (isDirectTransformOptions(currentOptions)) {
      apiData = currentOptions.transformFn(currentOptions.watchedValues);
    } else {
      const updateRequest = buildUpdateRequest(currentOptions.fieldMappings, currentOptions.values);
      apiData = updateRequest?.campaign ?? null;
    }

    if (!apiData) {
      return;
    }

    const serialized = JSON.stringify(apiData);
    if (serialized === lastSavedValue.current) {
      return;
    }
    lastSavedValue.current = serialized;

    mutate({ campaign: apiData });
  }, [...deps, shouldAutosave, campaignId, mutate]);

  const save = useCallback(async () => {
    if (!campaignId) {
      return;
    }

    flush();

    let apiData: UpdateCampaignRequestBody | null;
    const currentOptions = optionsRef.current;

    if (isDirectTransformOptions(currentOptions)) {
      const currentValues = methodsRef.current.getValues();
      apiData = currentOptions.transformFn(currentValues);
    } else {
      const formFieldNames = currentOptions.fieldMappings.map((m) => m.formField);
      const currentValues = formFieldNames.map((fieldName) => {
        return methodsRef.current.getValues(fieldName as any);
      });
      const updateRequest = buildUpdateRequest(currentOptions.fieldMappings, currentValues);
      apiData = updateRequest?.campaign ?? null;
    }

    if (!apiData) {
      return;
    }

    const serialized = JSON.stringify(apiData);
    if (serialized === lastSavedValue.current) {
      return;
    }
    lastSavedValue.current = serialized;

    await mutateAsync({ campaign: apiData });
  }, [campaignId, flush, mutateAsync]);

  return {
    isAutosaving: isPending,
    autosaveError: error,
    save,
  };
}
