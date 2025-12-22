import { useCallback, useEffect, useRef } from "react";
import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import { useCampaignService, type CampaignUpdateRequest } from "@api/campaigns.hooks";
import { mapApiErrorsToForm } from "@helpers/formErrorMapper";
import { useAdsChatState } from "./useAdsChat";
import { useLatestMutation } from "./useLatestMutation";
import type { UpdateCampaignResponse } from "@api/campaigns";

// ============================================================================
// Types
// ============================================================================

type AssetLike = { id: string; text: string };
type ApiFieldValue = AssetLike[];

export type FieldMapping<TFormData extends FieldValues> = {
  formField: Path<TFormData>;
  apiField: keyof NonNullable<CampaignUpdateRequest["campaign"]>;
  transform?: (value: AssetLike[] | undefined) => ApiFieldValue;
};

export type UseCampaignAutosaveOptions<TFormData extends FieldValues> = {
  methods: UseFormReturn<TFormData>;
  fieldMappings: FieldMapping<TFormData>[];
  values: unknown[];
  debounceMs?: number;
  onSuccess?: (data: { ready_for_next_stage?: boolean }) => void;
  enabled?: boolean;
};

export type UseCampaignAutosaveReturn = {
  isAutosaving: boolean;
  autosaveError: Error | null;
  save: () => Promise<void>;
};

// ============================================================================
// Helper Functions
// ============================================================================

const defaultAssetTransform = (assets: AssetLike[] | undefined): ApiFieldValue =>
  assets?.filter((a) => a.text?.trim()).map(({ id, text }) => ({ id, text })) ?? [];

function buildUpdateRequest<TFormData extends FieldValues>(
  fieldMappings: FieldMapping<TFormData>[],
  values: unknown[]
): CampaignUpdateRequest | null {
  const campaign: Record<string, ApiFieldValue> = {};
  let hasNonEmptyValue = false;

  fieldMappings.forEach((mapping, index) => {
    const transform = mapping.transform ?? defaultAssetTransform;
    const transformedValue = transform(values[index] as AssetLike[] | undefined);
    campaign[mapping.apiField] = transformedValue;
    if (transformedValue.length > 0) {
      hasNonEmptyValue = true;
    }
  });

  if (!hasNonEmptyValue) {
    return null;
  }

  return { campaign };
}

// ============================================================================
// Hook
// ============================================================================

export function useCampaignAutosave<TFormData extends FieldValues>({
  methods,
  fieldMappings,
  values,
  debounceMs = 750,
  onSuccess,
  enabled,
}: UseCampaignAutosaveOptions<TFormData>): UseCampaignAutosaveReturn {
  const campaignId = useAdsChatState("campaignId");
  const service = useCampaignService();
  const shouldAutosave = enabled ?? !!campaignId;

  const isInitialMount = useRef(true);
  const lastSavedValue = useRef<string | null>(null);

  const methodsRef = useRef(methods);
  methodsRef.current = methods;

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

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

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!shouldAutosave || !campaignId) {
      return;
    }

    const updateRequest = buildUpdateRequest(fieldMappings, values);
    if (!updateRequest) {
      return;
    }

    const serialized = JSON.stringify(updateRequest);
    if (serialized === lastSavedValue.current) {
      return;
    }
    lastSavedValue.current = serialized;

    mutate(updateRequest);
  }, [values, shouldAutosave, campaignId, fieldMappings, mutate]);

  const save = useCallback(async () => {
    if (!campaignId) {
      return;
    }

    flush();

    const formFieldNames = fieldMappings.map((m) => m.formField);
    const currentValues = formFieldNames.map((fieldName) => {
      return methodsRef.current.getValues(fieldName as any);
    });

    const updateRequest = buildUpdateRequest(fieldMappings, currentValues);
    if (!updateRequest) {
      return;
    }

    const serialized = JSON.stringify(updateRequest);
    if (serialized === lastSavedValue.current) {
      return;
    }
    lastSavedValue.current = serialized;

    await mutateAsync(updateRequest);
  }, [campaignId, fieldMappings, flush, mutateAsync]);

  return {
    isAutosaving: isPending,
    autosaveError: error,
    save,
  };
}
