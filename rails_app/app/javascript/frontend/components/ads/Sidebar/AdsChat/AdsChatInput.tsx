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
import type { AdCampaignChatFormType } from "../../ad-campaign.types";
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
    <div className="flex-col gap-2 w-full">
      <form onSubmit={handleFormSubmit} className="w-full">
        <InputGroup className="bg-white rounded-2xl">
          <Controller
            control={control}
            name="message"
            render={({ field, fieldState }) => (
              <InputGroupTextarea
                placeholder="Ask me for changes..."
                {...field}
                aria-invalid={!!fieldState.error}
              />
            )}
          />
          <InputGroupAddon align="block-end" className="flex justify-between">
            <InputGroupButton size="icon-sm">
              <FilePlus />
            </InputGroupButton>
            <InputGroupButton
              size="icon-sm"
              variant="destructive"
              className="rounded-full bg-secondary-500"
              type="submit"
              disabled={!isValid}
            >
              <ArrowUp />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
      <Button
        variant="link"
        className="text-base-400 font-normal self-start"
        onClick={onRefreshSuggestions}
      >
        <Sparkles /> Refresh All Suggestions
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