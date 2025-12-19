import InputLockable from "@components/forms/input-lockable";
import { Field, FieldError } from "@components/ui/field";
import type { Control, FieldArrayWithId } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { AdCampaignFormData } from "./AdCampaignForm.schema";

interface AdCampaignFieldListProps {
  fieldName: "headlines" | "descriptions" | "features" | "callouts" | "details" | "keywords";
  fields: FieldArrayWithId<AdCampaignFormData, "headlines" | "descriptions" | "features", "id">[];
  control: Control<AdCampaignFormData>;
  onLockToggle?: (
    fieldName: "headlines" | "descriptions" | "features" | "callouts" | "details" | "keywords",
    index: number
  ) => void;
  onDelete?: (index: number) => void;
  placeholder: string;
  maxLength: number;
  resolveIndex?: (id: string) => number;
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
      {fields.map((field, index) => {
        const originalIndex = resolveIndex ? resolveIndex(field.id) : index;
        return (
          <Controller
            key={field.id}
            name={`${fieldName}.${originalIndex}.text` as any}
            control={control}
            render={({ field: controllerField, fieldState }) => (
              <Field className="gap-1">
                <InputLockable
                  placeholder={placeholder}
                  value={controllerField.value as string}
                  onChange={controllerField.onChange}
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
