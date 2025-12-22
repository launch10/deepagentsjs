import type { FieldValues, Path } from "react-hook-form";
import type { CampaignUpdateRequest } from "@api/campaigns";

type AssetLike = { id: string; text: string };

type ApiAsset = { id?: number; text?: string };

export type FieldMapping<TFormData extends FieldValues> = {
  formField: Path<TFormData>;
  apiField: keyof NonNullable<CampaignUpdateRequest["campaign"]>;
  transform?: (value: AssetLike[] | undefined) => AssetLike[];
};

export const defaultAssetTransform = (assets: AssetLike[] | undefined): ApiAsset[] =>
  (assets?.filter((a) => a.text?.trim()).map(({ id, text }) => ({ id, text })) as ApiAsset[]) ?? [];

export function buildUpdateRequest<TFormData extends FieldValues>(
  fieldMappings: FieldMapping<TFormData>[],
  values: unknown[]
): CampaignUpdateRequest | null {
  const campaign: Record<string, AssetLike[]> = {};
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
