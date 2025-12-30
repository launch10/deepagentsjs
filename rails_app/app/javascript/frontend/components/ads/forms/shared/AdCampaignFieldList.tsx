import InputLockable from "@components/forms/input-lockable";
import { Field, FieldError } from "@components/ui/field";
import { Ads } from "@shared";
import type { Control, FieldArrayWithId } from "react-hook-form";
import { Controller } from "react-hook-form";
import z from "zod";

export const adCampaignSchema = z.object({
  adGroupName: z.string().min(1, "Ad group name is required"),
  headlines: Ads.HeadlinesOutputSchema,
  descriptions: Ads.DescriptionsOutputSchema,
  features: z.array(Ads.AssetSchema),
  callouts: Ads.CalloutsOutputSchema,
});

type AdCampaignFormData = z.infer<typeof adCampaignSchema>;

interface AdCampaignFieldListProps {
  fieldName: "headlines" | "descriptions" | "features" | "callouts" | "details" | "keywords";
  fields: FieldArrayWithId<
    AdCampaignFormData,
    "headlines.headlines" | "descriptions.descriptions" | "features" | "callouts.callouts",
    "id"
  >[];
  control: Control<AdCampaignFormData>;
  onLockToggle?: (
    fieldName: "headlines" | "descriptions" | "features" | "callouts" | "details" | "keywords",
    index: number
  ) => void;
  onDelete?: (index: number) => void;
  placeholder: string;
  maxLength: number;
  resolveIndex?: (id: string) => number;
  onInputChange?: (index: number, input: string) => void;
}

export default function AdCampaignFieldList({
  fieldName,
  fields,
  control,
  onLockToggle,
  onDelete,
  placeholder,
  maxLength,
  resolveIndex,
  onInputChange,
}: AdCampaignFieldListProps) {
  const handleLockToggle = (index: number) => {
    if (!onLockToggle) return;
    onLockToggle(fieldName, index);
  };

  const handleDelete = (index: number) => {
    if (!onDelete) return;
    onDelete(index);
  };

  return (
    <>
      {fields.map((field: Ads.Asset, index: number) => {
        const originalIndex = resolveIndex ? resolveIndex(field.id) : index;
        return (
          <Controller
            key={field.id}
            name={`${fieldName}.${index}.text` as any}
            control={control}
            render={({ field: controllerField, fieldState }) => (
              <Field className="gap-1">
                <InputLockable
                  placeholder={placeholder}
                  value={controllerField.value as string}
                  onChange={(e) => {
                    controllerField.onChange(e);
                    if (onInputChange) {
                      onInputChange(index, e.target.value);
                    }
                  }}
                  onBlur={controllerField.onBlur}
                  name={controllerField.name as string}
                  isLocked={field.locked}
                  onLockToggle={onLockToggle ? () => handleLockToggle(originalIndex) : undefined}
                  onDelete={onDelete ? () => handleDelete(originalIndex) : undefined}
                />
                <div className="flex">
                  {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  <div className="text-right text-xs text-[#8b8b8b] ml-auto">
                    {(controllerField.value as string)?.length ?? 0}/{maxLength}
                  </div>
                </div>
              </Field>
            )}
          />
        );
      })}
    </>
  );
}
