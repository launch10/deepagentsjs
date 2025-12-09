import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Field, FieldError, FieldLabel } from "@components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@components/ui/input-group";
import { Info, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { headlineSchema } from "./ad-campaign-form.schema";

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

    const result = headlineSchema.shape.value.safeParse(trimmed);
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
    <Field>
      <FieldLabel className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Headlines</span>
          <Info size={12} className="text-[#96989B]" />
          {/* TODO: Add "You need to select at least 3 headlines" error message */}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Select 3-{maxCount}</Badge>
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
      <InputGroup>
        <InputGroupInput
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
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="button" variant="secondary" onClick={handleAdd}>
            <Plus /> Add
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <div className="flex items-center">
        {displayError && <FieldError errors={[{ message: displayError }]} />}
        <div className="text-right text-sm text-[#8B8B8B] ml-auto">{value.length}/30</div>
      </div>
    </Field>
  );
}
