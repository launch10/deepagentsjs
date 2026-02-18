import { Badge } from "@components/ui/badge";
import { Field, FieldError } from "@components/ui/field";
import { Info } from "lucide-react";
import { useState } from "react";
import type { z } from "zod";
import RefreshSuggestionsButton from "./RefreshSuggestionsButton";
import InputAddable from "@components/shared/forms/input-addable";

interface AdCampaignAssetInputProps {
  label: string;
  onAdd: (value: string) => void;
  currentCount: number;
  maxCount: number;
  placeholder: string;
  maxLength: number;
  validationSchema: z.ZodType<string>;
  badgeText: string;
  error?: string;
  onRefreshSuggestions: () => void;
}

export default function AdCampaignAssetInput({
  label,
  onAdd,
  currentCount,
  maxCount,
  placeholder,
  maxLength,
  validationSchema,
  badgeText,
  error: externalError,
  onRefreshSuggestions,
}: AdCampaignAssetInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmed = value.trim();

    if (currentCount >= maxCount) {
      setError(`Maximum ${maxCount} allowed`);
      return;
    }

    const result = validationSchema.safeParse(trimmed);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? "Invalid input");
      return;
    }

    setError(null);
    onAdd(trimmed);
    setValue("");
  };

  const displayError = error || externalError;

  return (
    <Field className="gap-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-base-600">{label}</span>
          <Info size={12} className="text-base-300" />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{badgeText}</Badge>
          <RefreshSuggestionsButton onClick={onRefreshSuggestions} />
        </div>
      </div>
      <InputAddable
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
          }
        }}
        isInvalid={!!displayError}
        handleAdd={handleAdd}
        placeholder={placeholder}
      />
      <div className="flex items-center">
        {displayError && <FieldError errors={[{ message: displayError }]} />}
        <div className="text-right text-xs text-[#8b8b8b] ml-auto">
          {value.length}/{maxLength}
        </div>
      </div>
    </Field>
  );
}
