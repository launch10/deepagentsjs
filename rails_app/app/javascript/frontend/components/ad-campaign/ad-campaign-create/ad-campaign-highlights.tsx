import AdCampaignFieldList from "@components/ad-campaign/ad-campaign-form/ad-campaign-field-list";
import type { AdCampaignFormData } from "@components/ad-campaign/ad-campaign-form/ad-campaign-form.schema";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@components/ui/field";
import { Select, SelectTrigger, SelectValue } from "@components/ui/select";
import { Info, Plus, Sparkles } from "lucide-react";
import { useFormContext, type FieldArrayWithId } from "react-hook-form";

export default function AdCampaignHighlights({
  featuresFields,
}: {
  featuresFields: FieldArrayWithId<AdCampaignFormData, "features", "id">[];
}) {
  const { control, getValues, setValue } = useFormContext<AdCampaignFormData>();

  const handleLockToggle = (index: number) => {
    const isLocked = getValues("features")[index].isLocked;
    const updatedFields = getValues("features").map((field, i) =>
      i === index ? { ...field, isLocked: !isLocked } : field
    );
    setValue("features", updatedFields);
  };

  return (
    <div className="border-[#D3D2D0] border border-t-0 rounded-b-2xl bg-white">
      <div className="p-9 flex flex-col gap-6">
        <h2 className="text-lg font-semibold">Highlights</h2>
        <p className="text-sm text-[#74767A]">
          Highlights add useful information to your ads, like a phone number, location, specific
          website links, and more. They make your ad larger and give customers more reasons to
          click.
        </p>
        <FieldSet>
          <FieldGroup className="gap-2">
            <Field>
              <FieldLabel className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Unique Features</span>
                  <Info size={12} className="text-[#96989B]" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Select 2-10</Badge>
                  <Button type="button" variant="link" className="text-[#74767A] font-normal">
                    <Sparkles /> Refresh Suggestions
                  </Button>
                </div>
              </FieldLabel>
            </Field>
            <AdCampaignFieldList
              fieldName="features"
              fields={featuresFields}
              onLockToggle={(_, index: number) => handleLockToggle(index)}
              control={control}
              placeholder="Feature Option"
              maxLength={90}
            />
          </FieldGroup>
          <FieldGroup className="max-w-1/2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Product or Service Offerings</span>
              <Info size={12} className="text-[#96989B]" />
            </div>
            <Field>
              <FieldLabel className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-[#74767A]">Category</span>
                  <Info size={12} className="text-[#96989B]" />
                </div>
              </FieldLabel>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
              </Select>
            </Field>
            <Field>
              <FieldLabel className="flex justify-between items-center">
                <span className="font-semibold text-xs text-[#74767A]">Details</span>
                <Badge variant="secondary" className="ml-auto">
                  Select 3-10
                </Badge>
              </FieldLabel>
            </Field>
            <Button type="button" variant="link" className="justify-start">
              <Plus />
              Add Value
            </Button>
          </FieldGroup>
        </FieldSet>
      </div>
    </div>
  );
}
