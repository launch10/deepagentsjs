import InputLockable from "@components/forms/input-lockable";
import { Field, FieldError } from "@components/ui/field";
import type { Control, FieldArrayWithId } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { AdCampaignFormData } from "./AdCampaignForm.schema";

interface AdCampaignFieldListProps {
  fieldName: "headlines" | "descriptions" | "features" | "callouts";
  fields: FieldArrayWithId<AdCampaignFormData, "headlines" | "descriptions" | "features", "id">[];
  control: Control<AdCampaignFormData>;
  onLockToggle: (
    fieldName: "headlines" | "descriptions" | "features" | "callouts",
    index: number
  ) => void;
  placeholder: string;
  maxLength: number;
}

export default function AdCampaignFieldList({
  fieldName,
  fields,
  control,
  onLockToggle,
  placeholder,
  maxLength,
}: AdCampaignFieldListProps) {
  return (
    <>
      {fields.map((field, index) => (
        <Controller
          key={field.id}
          name={`${fieldName}.${index}.text`}
          control={control}
          render={({ field: controllerField, fieldState }) => (
            <Field className="gap-1">
              <InputLockable
                placeholder={placeholder}
                {...controllerField}
                isLocked={field.locked}
                onLockToggle={() => onLockToggle(fieldName, index)}
              />
              <div className="flex">
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
                <div className="text-right text-xs text-[#8b8b8b] ml-auto">
                  {controllerField.value?.length ?? 0}/{maxLength}
                </div>
              </div>
            </Field>
          )}
        />
      ))}
    </>
  );
}
