import type { FieldValues, Path } from "react-hook-form";
import type { CampaignUpdateRequest } from "@rails_api_base";

type AssetLike = { id: string; text: string };

// API expects id as optional number (database ID) and text as optional string
type ApiAsset = { id?: number; text?: string };

export type FieldMapping<TFormData extends FieldValues> = {
  formField: Path<TFormData>;
  apiField: keyof NonNullable<CampaignUpdateRequest["campaign"]>;
  transform?: (value: AssetLike[] | undefined) => ApiAsset[];
};

// Transform client-side assets (with UUID strings) to API format (text only, no client IDs)
export const defaultAssetTransform = (assets: AssetLike[] | undefined): ApiAsset[] =>
  assets?.filter((a) => a.text?.trim()).map(({ text }) => ({ text })) ?? [];

export function buildUpdateRequest<TFormData extends FieldValues>(
  fieldMappings: FieldMapping<TFormData>[],
  values: unknown[]
): CampaignUpdateRequest | null {
  const campaign: Record<string, ApiAsset[]> = {};
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
