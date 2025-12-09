import AdCampaignFieldList from "@components/ad-campaign/ad-campaign-form/ad-campaign-field-list";
import type {
  AdCampaignFormData,
  DescriptionData,
  HeadlineData,
} from "@components/ad-campaign/ad-campaign-form/ad-campaign-form.schema";
import AdCampaignHeadlineInput from "@components/ad-campaign/ad-campaign-form/ad-campaign-headline-input";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";
import { Info, Sparkles } from "lucide-react";
import { useFormContext, type FieldArrayWithId, type UseFormReturn } from "react-hook-form";

export default function AdCampaignContent({
  methods,
  appendHeadlines,
  headlinesFields,
  descriptionsFields,
}: {
  methods: UseFormReturn<AdCampaignFormData>;
  appendHeadlines: (value: HeadlineData) => void;
  headlinesFields: FieldArrayWithId<AdCampaignFormData, "headlines", "id">[];
  descriptionsFields: FieldArrayWithId<AdCampaignFormData, "descriptions", "id">[];
}) {
  const {
    register,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<AdCampaignFormData>();

  const handleAddHeadline = (value: string) => {
    appendHeadlines({ value, isLocked: false });
  };

  const handleLockToggle = (
    fieldName: "headlines" | "descriptions" | "features", // TODO: Move this function into a util
    index: number
  ) => {
    const isLocked = getValues(fieldName)[index].isLocked;
    const updatedFields = getValues(fieldName).map((field, i) =>
      i === index ? { ...field, isLocked: !isLocked } : field
    );
    setValue(fieldName, updatedFields);
  };

  const handleRefreshSuggestions = (fieldName: "headlines" | "descriptions") => {
    console.log(`Refresh suggestions for ${fieldName}`);
  };

  return (
    <div className="border-[#D3D2D0] border border-t-0 rounded-b-2xl bg-white">
      <div className="p-9 flex flex-col gap-6">
        <h2 className="text-lg font-semibold">Content</h2>
        <p className="text-sm text-[#74767A]">
          Content is the core of your ad. Think of billboard headlines. They describe the problem
          your business solves, and encourage users to click to learn more.
        </p>
        <FieldSet>
          <FieldGroup className="grid grid-cols-2">
            <Field>
              <label className="flex items-center gap-2">
                <span className="font-semibold">Ad Group Name</span>
                <Info size={12} className="text-[#96989B]" />
              </label>
              <InputGroup>
                <InputGroupInput
                  placeholder="Ad Group Name"
                  {...register("adGroupName")}
                  aria-invalid={!!errors.adGroupName}
                />
                <InputGroupAddon align="inline-end">
                  <Sparkles />
                </InputGroupAddon>
              </InputGroup>
              {errors.adGroupName && (
                <p className="text-sm text-destructive mt-1">{errors.adGroupName.message}</p>
              )}
            </Field>
          </FieldGroup>
          <FieldGroup>
            <AdCampaignHeadlineInput
              onAdd={handleAddHeadline}
              currentCount={methods.getValues("headlines").length}
              maxCount={15}
              error={errors.headlines?.message}
              onRefreshSuggestions={() => handleRefreshSuggestions("headlines")}
            />
            <AdCampaignFieldList
              fieldName="headlines"
              fields={headlinesFields}
              onLockToggle={handleLockToggle}
              control={control}
              placeholder="Headline Option"
              maxLength={30}
            />
          </FieldGroup>
          <FieldGroup>
            <Field>
              <FieldLabel className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Descriptions</span>
                  <Info size={12} className="text-[#96989B]" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Select 2-4</Badge>
                  <Button
                    type="button"
                    variant="link"
                    className="text-[#74767A] font-normal"
                    onClick={() => handleRefreshSuggestions("descriptions")}
                  >
                    <Sparkles /> Refresh Suggestions
                  </Button>
                </div>
              </FieldLabel>
            </Field>
            <AdCampaignFieldList
              fieldName="descriptions"
              fields={descriptionsFields}
              onLockToggle={handleLockToggle}
              control={control}
              placeholder="Description Option"
              maxLength={90}
            />
          </FieldGroup>
        </FieldSet>
      </div>
    </div>
  );
}
