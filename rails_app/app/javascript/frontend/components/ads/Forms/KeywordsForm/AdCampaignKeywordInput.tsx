import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Field, FieldError, FieldLabel } from "@components/ui/field";
import { Info, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import RefreshSuggestionsButton from "../shared/RefreshSuggestionsButton";
import InputAddable from "@components/forms/input-addable";

const keywordSchema = z.object({
  text: z.string().min(1, "Keyword cannot be empty").max(80, "Maximum 80 characters"),
});

interface AdCampaignKeywordInputProps {
  onAdd: (value: string) => void;
  currentCount: number;
  maxCount: number;
  error?: string;
  onRefreshSuggestions: () => void;
}

export default function AdCampaignKeywordInput({
  onAdd,
  currentCount,
  maxCount,
  error: externalError,
  onRefreshSuggestions,
}: AdCampaignKeywordInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmed = value.trim();

    if (currentCount >= maxCount) {
      setError(`Maximum ${maxCount} keywords allowed`);
      return;
    }

    const result = keywordSchema.shape.text.safeParse(trimmed);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? "Invalid keyword");
      return;
    }

    setError(null);
    onAdd(trimmed);
    setValue("");
  };

  const displayError = error || externalError;

  return (
    <Field className="gap-2">
      <FieldLabel className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-base-600">Keywords</span>
          <Info size={12} className="text-base-300" />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Select 5-{maxCount}</Badge>
          <RefreshSuggestionsButton onClick={onRefreshSuggestions} />
        </div>
      </FieldLabel>
      <InputAddable
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
          }
        }}
        isInvalid={!!displayError}
        handleAdd={handleAdd}
        placeholder="Enter keywords, separated by commas"
        className="flex-1 h-10 px-4 text-xs placeholder:text-neutral-400 outline-none bg-transparent border-none shadow-none"
      />
      <div className="flex items-center">
        {displayError && <FieldError errors={[{ message: displayError }]} />}
        <div className="text-right text-xs text-base-300 ml-auto">{value.length}/80</div>
      </div>
    </Field>
  );
}
