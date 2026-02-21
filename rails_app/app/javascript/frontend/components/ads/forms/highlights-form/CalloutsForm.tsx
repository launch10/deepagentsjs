import { FieldGroup } from "@components/ui/field";
import AdCampaignAssetInput from "../shared/AdCampaignAssetInput";
import AdCampaignFieldList from "@components/ads/forms/shared/AdCampaignFieldList";
import { useAssetForm } from "@components/ads/hooks/useAssetForm";
import { defaultAssetTransform } from "@components/ads/hooks";
import { Ads } from "@shared";
import type { UpdateCampaignRequestBody } from "@rails_api_base";

export default function CalloutsForm() {
  const { addAsset, removeAsset, updateAsset, lockToggle, refreshAssets, fields, methods, control } =
    useAssetForm({
      assetKey: "callouts",
      formId: "callouts",
      formGroup: "highlights",
      schema: Ads.CalloutsOutputSchema,
      transformFn: (data): Partial<UpdateCampaignRequestBody> | null => {
        const transformed = defaultAssetTransform(data.callouts);
        if (transformed.length === 0) return null;
        return { callouts: transformed };
      },
      refreshStage: "highlights",
    });

  return (
    <FieldGroup className="gap-2">
      <AdCampaignAssetInput
        label="Unique Features"
        onAdd={addAsset}
        currentCount={fields.length}
        maxCount={10}
        placeholder="Enter feature"
        maxLength={25}
        validationSchema={Ads.calloutsSchema.shape.text}
        badgeText="Select 2-10"
        error={methods.formState.errors.callouts?.message as string | undefined}
        onRefreshSuggestions={refreshAssets}
      />
      <AdCampaignFieldList
        fieldName="callouts"
        fields={fields as any}
        onLockToggle={lockToggle}
        onDelete={removeAsset}
        control={control as any}
        placeholder="Feature Option"
        maxLength={25}
        onInputChange={updateAsset}
      />
    </FieldGroup>
  );
}
