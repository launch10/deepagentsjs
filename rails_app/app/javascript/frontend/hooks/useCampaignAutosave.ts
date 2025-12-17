import { useEffect, useRef } from "react";
import { usePage } from "@inertiajs/react";
import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import type { CampaignProps } from "@components/ads/Sidebar/WorkflowBuddy/ad-campaign.types";
import { useAutosaveCampaign, type CampaignUpdateRequest } from "@api/campaigns.hooks";
import { useDebounce } from "./useDebounce";
import { mapApiErrorsToForm } from "@helpers/formErrorMapper";

// ============================================================================
// Types
// ============================================================================

type AssetLike = { id: string; text: string };
type ApiFieldValue = AssetLike[];

/**
 * Configuration for field-to-API mapping.
 * Maps form field names to their API counterparts and transformation functions.
 */
export type FieldMapping<TFormData extends FieldValues> = {
  /** The field name in your form */
  formField: Path<TFormData>;
  /** The field name in the API request */
  apiField: keyof NonNullable<CampaignUpdateRequest["campaign"]>;
  /** Optional transform function (default: maps to { id, text }) */
  transform?: (value: AssetLike[] | undefined) => ApiFieldValue;
};

export type UseCampaignAutosaveOptions<TFormData extends FieldValues> = {
  /** React Hook Form methods */
  methods: UseFormReturn<TFormData>;
  /** Field mappings from form to API */
  fieldMappings: FieldMapping<TFormData>[];
  /** Debounce delay in ms (default: 750) */
  debounceMs?: number;
  /** Callback when autosave succeeds */
  onSuccess?: (data: { ready_for_next_stage?: boolean }) => void;
  /** Whether autosave is enabled (default: true when campaignId exists) */
  enabled?: boolean;
};

export type UseCampaignAutosaveReturn = {
  isAutosaving: boolean;
  autosaveError: Error | null;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Default transform for asset-like fields (headlines, descriptions, etc.)
 * Filters out empty text and maps to { id, text } format.
 */
const defaultAssetTransform = (assets: AssetLike[] | undefined): ApiFieldValue =>
  assets?.filter((a) => a.text?.trim()).map(({ id, text }) => ({ id, text })) ?? [];

/**
 * Builds the API update request from field mappings and current values.
 */
function buildUpdateRequest<TFormData extends FieldValues>(
  fieldMappings: FieldMapping<TFormData>[],
  values: unknown[]
): CampaignUpdateRequest {
  const campaign: Record<string, ApiFieldValue> = {};

  fieldMappings.forEach((mapping, index) => {
    const transform = mapping.transform ?? defaultAssetTransform;
    campaign[mapping.apiField] = transform(values[index] as AssetLike[] | undefined);
  });

  return { campaign };
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for autosaving campaign form data with debouncing and error handling.
 *
 * Features:
 * - Debounced autosave to prevent excessive API calls
 * - Skips initial mount to avoid saving unchanged data
 * - Deduplicates saves when values haven't changed
 * - Maps API validation errors back to form fields
 *
 * @example
 * ```tsx
 * const { isAutosaving } = useCampaignAutosave({
 *   methods,
 *   fieldMappings: [
 *     { formField: "headlines", apiField: "headlines" },
 *     { formField: "descriptions", apiField: "descriptions" },
 *   ],
 *   onSuccess: (data) => {
 *     if (data.ready_for_next_stage !== undefined) {
 *       setIsReadyForNextStage(data.ready_for_next_stage);
 *     }
 *   },
 * });
 * ```
 */
export function useCampaignAutosave<TFormData extends FieldValues>({
  methods,
  fieldMappings,
  debounceMs = 750,
  onSuccess,
  enabled,
}: UseCampaignAutosaveOptions<TFormData>): UseCampaignAutosaveReturn {
  const campaignId = usePage<CampaignProps>().props.campaign?.id;
  const autosaveMutation = useAutosaveCampaign(campaignId);

  const isInitialMount = useRef(true);
  const lastSavedValue = useRef<string | null>(null);

  const watchedFields = fieldMappings.map((m) => methods.watch(m.formField));
  const debouncedFields = useDebounce(watchedFields, debounceMs);
  const shouldAutosave = enabled ?? !!campaignId;

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!shouldAutosave || !campaignId || autosaveMutation.isPending) {
      return;
    }

    const updateRequest = buildUpdateRequest(fieldMappings, debouncedFields);
    const serialized = JSON.stringify(updateRequest);

    if (serialized === lastSavedValue.current) {
      return;
    }
    lastSavedValue.current = serialized;

    autosaveMutation.mutate(updateRequest, {
      onSuccess,
      onError: (error) => {
        return mapApiErrorsToForm(error, methods);
      },
    });
  }, [debouncedFields, shouldAutosave, campaignId, autosaveMutation.isPending, fieldMappings]);

  return {
    isAutosaving: autosaveMutation.isPending,
    autosaveError: autosaveMutation.error,
  };
}
