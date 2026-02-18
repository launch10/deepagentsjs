import { Badge } from "@components/ui/badge";
import { Field, FieldGroup } from "@components/ui/field";
import AdCampaignFieldList from "@components/ads/forms/shared/AdCampaignFieldList";
import { useAssetForm } from "@components/ads/hooks/useAssetForm";
import { defaultAssetTransform } from "@components/ads/hooks";
import { Ads } from "@shared";
import { Info } from "lucide-react";
import RefreshSuggestionsButton from "../shared/RefreshSuggestionsButton";
import type { UpdateCampaignRequestBody } from "@rails_api_base";

export default function DescriptionsForm() {
  const { removeAsset, updateAsset, lockToggle, refreshAssets, fields, methods, control } =
    useAssetForm({
      assetKey: "descriptions",
      formId: "descriptions",
      formGroup: "content",
      schema: Ads.DescriptionsOutputSchema,
      transformFn: (data): Partial<UpdateCampaignRequestBody> | null => {
        const transformed = defaultAssetTransform(data.descriptions);
        if (transformed.length === 0) return null;
        return { descriptions: transformed };
      },
      refreshStage: "content",
    });

  return (
    <FieldGroup className="gap-3">
      <Field>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Details</span>
            <Info size={12} className="text-base-300" />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Select 2-4</Badge>
            <RefreshSuggestionsButton onClick={refreshAssets} />
          </div>
        </div>
      </Field>
      <AdCampaignFieldList
        fieldName="descriptions"
        fields={fields as any}
        onLockToggle={lockToggle}
        onDelete={removeAsset}
        control={control as any}
        placeholder="Description Option"
        maxLength={90}
        onInputChange={updateAsset}
      />
    </FieldGroup>
  );
}
