import { useCallback } from "react";
import { Button } from "@components/ui/button";
import { ArrowUp, FilePlus, Sparkles, Square } from "lucide-react";
import { useAdsChatActions } from "@hooks/useAdsChat";
import { Chat } from "@components/chat/Chat";
import { useWorkflow, selectSubstep } from "@context/WorkflowProvider";
import { Ads } from "@shared";

/**
 * Ads chat input using Chat compound components.
 *
 * Uses context-aware components that automatically bind to the composer,
 * handle streaming state, and manage attachments. Submit behavior is
 * configured at Chat.Root level.
 *
 * Now supports file drop and attachments like BrainstormInput.
 */
export default function AdsChatInput() {
  // Ads-specific actions for refresh suggestions
  const { updateState } = useAdsChatActions();
  const substep = useWorkflow(selectSubstep);

  const onRefreshSuggestions = useCallback(() => {
    const refresh = Ads.refreshAllCommand(substep as Ads.StageName);
    updateState({ refresh });
  }, [substep, updateState]);

  return (
    <div className="flex flex-col gap-1 w-full">
      <Chat.Input.DropZone className="relative bg-white border border-neutral-300 rounded-2xl p-3 flex flex-col min-h-[80px]">
        <Chat.Input.AttachmentList className="flex flex-wrap gap-2 mb-2" />

        <Chat.Input.Textarea
          placeholder="Ask me for changes..."
          className="flex-1 text-xs min-h-[40px]"
        />

        <div className="flex items-center justify-between mt-auto pt-2">
          <Chat.Input.FileButton className="text-base-500 p-1 hover:bg-neutral-100 rounded">
            <FilePlus className="size-4" />
          </Chat.Input.FileButton>

          <Chat.Input.SubmitButton
            stopIcon={<Square className="size-3" fill="currentColor" />}
            className="rounded-full bg-secondary-500 text-white hover:bg-secondary-600 size-6 flex items-center justify-center"
          >
            <ArrowUp className="size-4" />
          </Chat.Input.SubmitButton>
        </div>
      </Chat.Input.DropZone>

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
