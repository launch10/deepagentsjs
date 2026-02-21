import { useRef } from "react";
import { z } from "zod";
import { FieldGroup } from "@components/ui/field";
import AdCampaignAssetInput from "../shared/AdCampaignAssetInput";
import AdCampaignFieldList from "../shared/AdCampaignFieldList";
import { useAssetForm } from "@components/ads/hooks/useAssetForm";
import { Ads } from "@shared";
import type { UpdateCampaignRequestBody } from "@rails_api_base";

const keywordsFormSchema = z.object({
  keywords: z.array(Ads.AssetSchema),
});

const keywordTextSchema = z.string().min(1, "Keyword cannot be empty").max(80, "Maximum 80 characters");

export default function KeywordTargetingForm() {
  const gridEndRef = useRef<HTMLDivElement>(null);

  const { addAsset, removeAsset, updateAsset, lockToggle, refreshAssets, fields, methods, control } =
    useAssetForm({
      assetKey: "keywords",
      formId: "keywords",
      formGroup: "keywords",
      schema: keywordsFormSchema,
      transformFn: (data): Partial<UpdateCampaignRequestBody> | null => {
        const transformed = data.keywords
          ?.filter((k: Ads.Asset) => k.text?.trim())
          .map(({ id, text }: Ads.Asset) => ({ id, text, match_type: "broad" }));
        if (!transformed || transformed.length === 0) return null;
        return { keywords: transformed as unknown as UpdateCampaignRequestBody["keywords"] };
      },
      refreshStage: "keywords",
    });

  const handleAddKeyword = (value: string) => {
    addAsset(value);

    setTimeout(() => {
      const element = gridEndRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const paginationHeight = 80;
      const viewportBottom = window.innerHeight - paginationHeight;

      if (rect.bottom > viewportBottom) {
        window.scrollBy({
          top: rect.bottom - viewportBottom + 16,
          behavior: "smooth",
        });
      }
    }, 0);
  };

  const leftColumnFields = fields.filter((_, i) => i % 2 === 0);
  const rightColumnFields = fields.filter((_, i) => i % 2 === 1);
  const resolveIndex = (id: string) => fields.findIndex((f) => f.id === id);

  return (
    <FieldGroup className="gap-4">
      <AdCampaignAssetInput
        label="Keywords"
        onAdd={handleAddKeyword}
        currentCount={fields.length}
        maxCount={15}
        placeholder="Enter keywords, separated by commas"
        maxLength={80}
        validationSchema={keywordTextSchema}
        badgeText="Select 5-15"
        error={methods.formState.errors.keywords?.message as string | undefined}
        onRefreshSuggestions={refreshAssets}
      />
      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <div className="flex flex-col gap-4">
          <AdCampaignFieldList
            fieldName="keywords"
            fields={leftColumnFields as any}
            onLockToggle={lockToggle}
            onDelete={removeAsset}
            control={control as any}
            placeholder="Keyword Option"
            maxLength={80}
            resolveIndex={resolveIndex}
            onInputChange={updateAsset}
          />
        </div>
        <div className="flex flex-col gap-4">
          <AdCampaignFieldList
            fieldName="keywords"
            fields={rightColumnFields as any}
            onLockToggle={lockToggle}
            onDelete={removeAsset}
            control={control as any}
            placeholder="Keyword Option"
            maxLength={80}
            resolveIndex={resolveIndex}
            onInputChange={updateAsset}
          />
        </div>
        <div ref={gridEndRef} />
      </div>
    </FieldGroup>
  );
}
