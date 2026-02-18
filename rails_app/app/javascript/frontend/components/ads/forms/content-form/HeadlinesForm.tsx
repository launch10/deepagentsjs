import { FieldGroup } from "@components/ui/field";
import AdCampaignAssetInput from "../shared/AdCampaignAssetInput";
import AdCampaignFieldList from "../shared/AdCampaignFieldList";
import { useAssetForm } from "@components/ads/hooks/useAssetForm";
import { defaultAssetTransform } from "@components/ads/hooks";
import { Ads } from "@shared";
import type { UpdateCampaignRequestBody } from "@rails_api_base";

export default function HeadlinesForm() {
  const { addAsset, removeAsset, updateAsset, lockToggle, refreshAssets, fields, methods, control } =
    useAssetForm({
      assetKey: "headlines",
      formId: "headlines",
      formGroup: "content",
      schema: Ads.HeadlinesOutputSchema,
      transformFn: (data): Partial<UpdateCampaignRequestBody> | null => {
        const transformed = defaultAssetTransform(data.headlines);
        if (transformed.length === 0) return null;
        return { headlines: transformed };
      },
      refreshStage: "content",
    });

  return (
    <FieldGroup className="gap-3">
      <AdCampaignAssetInput
        label="Headlines"
        onAdd={addAsset}
        currentCount={fields.length}
        maxCount={15}
        placeholder="Enter headline"
        maxLength={30}
        validationSchema={Ads.headlineSchema.shape.text}
        badgeText="Select 3-15"
        error={methods.formState.errors.headlines?.message as string | undefined}
        onRefreshSuggestions={refreshAssets}
      />
      <AdCampaignFieldList
        fieldName="headlines"
        fields={fields as any}
        onLockToggle={lockToggle}
        onDelete={removeAsset}
        control={control as any}
        placeholder="Headline Option"
        maxLength={30}
        onInputChange={updateAsset}
      />
    </FieldGroup>
  );
}
