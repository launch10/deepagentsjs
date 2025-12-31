import { useCallback, type KeyboardEvent } from "react";
import { Button } from "@components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@components/ui/input-group";
import { ArrowUp, FilePlus, Sparkles } from "lucide-react";
import { useAdsChatActions } from "@hooks/useAdsChat";
import { useChatComposer, useChatIsStreaming, useChatSendMessage } from "@components/chat";
import { useWorkflowSteps, selectSubstep } from "@context/WorkflowStepsProvider";
import { Ads } from "@shared";

export interface AdsChatInputViewProps {
  /** Current input text value */
  text: string;
  /** Callback to update input text */
  onTextChange: (value: string) => void;
  /** Callback when form is submitted */
  onSubmit: () => void;
  /** Callback when Enter key is pressed (for keyboard submit) */
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Whether the submit button should be disabled */
  isDisabled: boolean;
  /** Callback when refresh suggestions is clicked */
  onRefreshSuggestions?: () => void;
}

/**
 * Pure presentation component for ads chat input.
 * Now uses controlled input pattern instead of react-hook-form.
 */
export function AdsChatInputView({
  text,
  onTextChange,
  onSubmit,
  onKeyDown,
  isDisabled,
  onRefreshSuggestions = () => {},
}: AdsChatInputViewProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="w-full">
        <InputGroup className="bg-white rounded-2xl border border-neutral-300">
          <InputGroupTextarea
            placeholder="Ask me for changes..."
            className="min-h-[40px] text-xs"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <InputGroupAddon align="block-end" className="flex justify-between">
            <InputGroupButton size="icon-sm">
              <FilePlus className="size-4" />
            </InputGroupButton>
            <InputGroupButton
              size="icon-sm"
              variant="destructive"
              className="rounded-full bg-secondary-500 size-6"
              type="button"
              disabled={isDisabled}
              onClick={onSubmit}
            >
              <ArrowUp className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
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

/**
 * Container component for ads chat input.
 * Uses Chat context for composer state instead of react-hook-form.
 */
export default function AdsChatInput() {
  // Use context hooks (requires Chat.Root ancestor)
  const composer = useChatComposer();
  const isStreaming = useChatIsStreaming();
  const sendMessage = useChatSendMessage();

  // Ads-specific actions for refresh suggestions
  const { updateState } = useAdsChatActions();
  const substep = useWorkflowSteps(selectSubstep);

  const isDisabled = !composer.text.trim() || isStreaming;

  const handleSubmit = useCallback(() => {
    if (composer.text.trim()) {
      sendMessage();
    }
  }, [composer.text, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const onRefreshSuggestions = useCallback(() => {
    const refresh = Ads.refreshAllCommand(substep as Ads.StageName);
    updateState({ refresh });
  }, [substep, updateState]);

  return (
    <AdsChatInputView
      text={composer.text}
      onTextChange={composer.setText}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      isDisabled={isDisabled}
      onRefreshSuggestions={onRefreshSuggestions}
    />
  );
}