import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Field, FieldError, FieldLabel } from "@components/ui/field";
import { Info, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

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
          <Button
            type="button"
            variant="link"
            className="text-[#74767A] font-normal"
            onClick={onRefreshSuggestions}
          >
            <Sparkles /> Refresh Suggestions
          </Button>
        </div>
      </FieldLabel>
      <div className="flex border border-neutral-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-ring">
        <input
          placeholder="Enter keywords, separated by commas"
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
          aria-invalid={!!displayError}
          className="flex-1 h-10 px-4 text-xs placeholder:text-neutral-400 outline-none bg-transparent border-none shadow-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-2 h-10 px-3 bg-background border-l border-neutral-300 text-sm text-base-500 hover:bg-neutral-100"
        >
          <Plus size={16} /> Add
        </button>
      </div>
      <div className="flex items-center">
        {displayError && <FieldError errors={[{ message: displayError }]} />}
        <div className="text-right text-xs text-[#8b8b8b] ml-auto">{value.length}/80</div>
      </div>
    </Field>
  );
}
