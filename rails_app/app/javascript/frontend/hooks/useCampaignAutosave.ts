import { useEffect, useRef } from "react";
import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import { useAutosaveCampaign, type CampaignUpdateRequest } from "@api/campaigns.hooks";
import { useDebounce } from "./useDebounce";
import { mapApiErrorsToForm } from "@helpers/formErrorMapper";
import { useAdsChatState } from "./useAdsChat";

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
  save: () => Promise<void>;
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
 * Returns null if all transformed values are empty (to prevent accidental deletion).
 */
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

  // Don't send empty updates - they would delete all existing records
  if (!hasNonEmptyValue) {
    return null;
  }

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
  const campaignId = useAdsChatState("campaignId");
  const autosaveMutation = useAutosaveCampaign(campaignId);

  const isInitialMount = useRef(true);
  const lastSavedValue = useRef<string | null>(null);
  const pendingSavePromise = useRef<Promise<void> | null>(null);

  const formFieldNames = fieldMappings.map((m) => m.formField);
  const watchedFields = methods.watch(formFieldNames);
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

    // Skip if all fields are empty (prevents accidental deletion)
    if (!updateRequest) {
      return;
    }

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

  const save = async () => {
    if (!campaignId) {
      return;
    }

    // If a save is already in progress, wait for it to complete
    // This prevents duplicate API calls when multiple forms save simultaneously
    if (pendingSavePromise.current) {
      await pendingSavePromise.current;
    }

    const currentValues = formFieldNames.map((fieldName) => {
      return methods.getValues(fieldName as any);
    });

    const updateRequest = buildUpdateRequest(fieldMappings, currentValues);

    // Skip if all fields are empty (prevents accidental deletion)
    if (!updateRequest) {
      return;
    }

    const serialized = JSON.stringify(updateRequest);

    // Skip if already saved and no changes
    if (serialized === lastSavedValue.current) {
      return;
    }

    // Create and track the save promise to prevent duplicate calls
    const savePromise = (async () => {
      try {
        const data = await autosaveMutation.mutateAsync(updateRequest);
        lastSavedValue.current = serialized;
        onSuccess?.(data);
      } catch (error) {
        mapApiErrorsToForm(error, methods);
        throw error;
      } finally {
        // Clear the pending promise when done
        pendingSavePromise.current = null;
      }
    })();

    pendingSavePromise.current = savePromise;
    await savePromise;
  };

  return {
    isAutosaving: autosaveMutation.isPending,
    autosaveError: autosaveMutation.error,
    save,
  };
}
