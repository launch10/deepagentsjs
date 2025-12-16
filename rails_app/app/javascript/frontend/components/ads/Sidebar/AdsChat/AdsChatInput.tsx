import { Button } from "@components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@components/ui/input-group";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUp, FilePlus, Sparkles } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import { useAdsChatActions } from "@hooks/useAdsChat";
import type { AdCampaignChatFormType } from "../WorkflowBuddy/ad-campaign.types";
import { useWorkflowSteps, selectSubstep } from "@context/WorkflowStepsProvider";
import { Ads } from "@shared";

const messageSchema = z.object({ message: z.string().min(1, "Message is required") }).required();

export interface AdsChatInputViewProps {
  onSubmit: (message: string) => void;
  onRefreshSuggestions?: () => void;
}

export function AdsChatInputView({ onSubmit, onRefreshSuggestions = () => {} }: AdsChatInputViewProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<AdCampaignChatFormType>({
    defaultValues: { message: "" },
    resolver: zodResolver(messageSchema),
    mode: "onChange",
  });

  const handleFormSubmit = handleSubmit((data) => {
    onSubmit(data.message);
    reset();
  });

  return (
    <div className="flex flex-col gap-1 w-full">
      <form onSubmit={handleFormSubmit} className="w-full">
        <InputGroup className="bg-white rounded-2xl border border-neutral-300">
          <Controller
            control={control}
            name="message"
            render={({ field, fieldState }) => (
              <InputGroupTextarea
                placeholder="Ask me for changes..."
                className="min-h-[40px] text-xs"
                {...field}
                aria-invalid={!!fieldState.error}
              />
            )}
          />
          <InputGroupAddon align="block-end" className="flex justify-between">
            <InputGroupButton size="icon-sm">
              <FilePlus className="size-4" />
            </InputGroupButton>
            <InputGroupButton
              size="icon-sm"
              variant="destructive"
              className="rounded-full bg-secondary-500 size-6"
              type="submit"
              disabled={!isValid}
            >
              <ArrowUp className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
      <Button
        variant="link"
        className="text-base-400 font-normal text-xs px-0 py-1 h-auto justify-start gap-1"
        onClick={onRefreshSuggestions}
      >
        <Sparkles className="size-3.5" /> Refresh All Suggestions
      </Button>
    </div>
  );
}

export default function AdsChatInput() {
  const { sendMessage, updateState } = useAdsChatActions();
  const substep = useWorkflowSteps(selectSubstep)

  const onRefreshSuggestions = () => {
    const refresh = Ads.refreshAllCommand(substep as Ads.StageName)
    updateState({ refresh })
  }

  return (
    <AdsChatInputView
      onSubmit={sendMessage}
      onRefreshSuggestions={onRefreshSuggestions}
    />
  );
}