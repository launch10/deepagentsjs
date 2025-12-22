import { useFormContext, Controller, useFormState } from "react-hook-form";
import { Sparkles } from "lucide-react";
import { useAdsChatActions } from "@hooks/useAdsChat";
import type { SettingsFormData } from "./settingsForm.schema";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";
import { Field, FieldError, FieldLabel } from "@components/ui/field";

export default function DailyBudget() {
  const { sendMessage } = useAdsChatActions();
  const { control } = useFormContext<SettingsFormData>();
  const { errors } = useFormState({ control });

  const handleAskChat = () => {
    sendMessage("Suggest appropriate daily budget amounts for this ad campaign");
  };

  return (
    <Field className="flex flex-col gap-2">
      <FieldLabel className="text-sm font-semibold leading-[18px] text-base-500">
        Daily Budget (USD)
      </FieldLabel>
      <div className="flex gap-3 items-center">
        <InputGroup className="flex-1">
          <InputGroupAddon>$</InputGroupAddon>
          <Controller
            name="budget"
            control={control}
            render={({ field }) => (
              <InputGroupInput
                type="number"
                value={field.value}
                onChange={(e) => {
                  const val = e.target.value;
                  field.onChange(val === "" ? "" : Number(val));
                }}
              />
            )}
          />
        </InputGroup>
        <button
          type="button"
          onClick={handleAskChat}
          className="flex items-center gap-3 rounded-lg border border-[#5f7e78] bg-[#eaf5f3] px-4 py-[14px] hover:bg-[#dceee9] transition-colors"
        >
          {/* TODO: Add style this to Button component variations */}
          <Sparkles className="h-4 w-4 text-[#0d342b]" />
          <span className="text-sm leading-[18px] text-[#081f1a]">
            Ask chat for recommendations
          </span>
        </button>
      </div>
      <FieldError errors={[{ message: errors.budget?.message }]} />
    </Field>
  );
}
