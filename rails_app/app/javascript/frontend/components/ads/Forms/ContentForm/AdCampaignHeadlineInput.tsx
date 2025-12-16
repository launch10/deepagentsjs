import { Badge } from "@components/ui/badge";
import { Field, FieldError } from "@components/ui/field";
import { Info, Plus } from "lucide-react";
import { useState } from "react";
import { headlineSchema } from "../shared/AdCampaignForm.schema";
import RefreshSuggestionsButton from "../shared/RefreshSuggestionsButton";

interface AdCampaignHeadlineInputProps {
  onAdd: (value: string) => void;
  currentCount: number;
  maxCount: number;
  error?: string;
  onRefreshSuggestions: () => void;
}

export default function AdCampaignHeadlineInput({
  onAdd,
  currentCount,
  maxCount,
  error: externalError,
  onRefreshSuggestions,
}: AdCampaignHeadlineInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmed = value.trim();

    if (currentCount >= maxCount) {
      setError(`Maximum ${maxCount} headlines allowed`);
      return;
    }

    if (!trimmed.length) {
      setError("Headline cannot be empty");
      return;
    }

    const result = headlineSchema.shape.text.safeParse(trimmed);
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? "Invalid headline");
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
          <span className="font-semibold text-base-600">Headlines</span>
          <Info size={12} className="text-base-300" />
          {/* TODO: Add "You need to select at least 3 headlines" error message */}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Select 3-{maxCount}</Badge>
          <RefreshSuggestionsButton onClick={onRefreshSuggestions} />
        </div>
      </div>
      <div className="flex border border-neutral-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-ring">
        <input
          placeholder="Enter headline"
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
        <div className="text-right text-xs text-[#8b8b8b] ml-auto">{value.length}/30</div>
      </div>
    </Field>
  );
}
