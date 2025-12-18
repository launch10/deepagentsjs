import { Button } from "@components/ui/button";
import {
  selectBack,
  selectCanGoBack,
  selectCanGoForward,
  selectContinue,
  selectSubstep,
  useWorkflowSteps,
} from "@context/WorkflowStepsProvider";
import { useAdvanceCampaign, useBackCampaign } from "@api/campaigns.hooks";
import { selectValidate, useFormRegistry } from "@stores/formRegistry";
import { twMerge } from "tailwind-merge";
import { Spinner } from "../ui/spinner";
import { useAdsChatState } from "@hooks/useAdsChat";
interface AdCampaignPaginationProps {
  className?: string;
  handleBack: () => void;
  handleContinue: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  isPending?: boolean;
}

export default function AdCampaignPagination({ className }: { className?: string }) {
  const validateForm = useFormRegistry(selectValidate);
  const campaignId = useAdsChatState("campaignId");

  const substep = useWorkflowSteps(selectSubstep);
  const workflowContinue = useWorkflowSteps(selectContinue)!;
  const workflowBack = useWorkflowSteps(selectBack)!;
  const canGoBack = useWorkflowSteps(selectCanGoBack)!;
  const canGoForward = useWorkflowSteps(selectCanGoForward) || true;

  const { mutate: advanceCampaign, isPending: isAdvancing } = useAdvanceCampaign(campaignId);
  const { mutate: backCampaign, isPending: isGoingBack } = useBackCampaign(campaignId);

  const handleContinue = async () => {
    if (!substep) return;

    const isValid = await validateForm(substep);
    if (!isValid) return;

    advanceCampaign(undefined, {
      onSuccess: () => {
        workflowContinue();
      },
      onError: (err) => {
        console.error(err);
      },
    });
  };

  const handleBack = () => {
    backCampaign(undefined, {
      onSuccess: () => {
        workflowBack();
      },
      onError: (err) => {
        console.error(err);
      },
    });
  };

  return (
    <AdCampaignPaginationView
      className={className}
      handleBack={handleBack}
      handleContinue={handleContinue}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      isPending={isAdvancing || isGoingBack}
    />
  );
}

export function AdCampaignPaginationView({
  className,
  handleBack,
  handleContinue,
  canGoBack,
  canGoForward,
  isPending,
}: AdCampaignPaginationProps) {
  const campaignId = useAdsChatState("campaignId");

  return (
    <div
      className={twMerge(
        "sticky bottom-0 mt-3",
        "bg-background border-t border-neutral-200 py-4 px-6 shadow-[9px_-16px_26.1px_1px_#74767A12]",
        className
      )}
    >
      <div className="flex justify-between items-center">
        <Button
          variant="link"
          onClick={handleBack}
          disabled={!campaignId || !canGoBack || isPending}
        >
          Previous Step
        </Button>
        <Button onClick={handleContinue} disabled={!campaignId || !canGoForward || isPending}>
          {isPending && <Spinner />}
          Continue
        </Button>
      </div>
    </div>
  );
}
