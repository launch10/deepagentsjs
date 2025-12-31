import { AdCampaignPaginationView } from "./AdCampaignPaginationView";
import { useCampaignPagination } from "./useCampaignPagination";
import { selectSubstep, useWorkflowSteps } from "@context/WorkflowStepsProvider";
import type { PaginationVariant } from "./AdCampaignPagination.types";

interface AdCampaignPaginationProps {
  className?: string;
}

export default function AdCampaignPagination({ className }: AdCampaignPaginationProps) {
  const {
    handleBack,
    handleContinue,
    returnToReview,
    canGoBack,
    canGoForward,
    isPending,
    showPrimaryAction,
    validationFailed,
    clearValidationFailed,
  } = useCampaignPagination();

  const substep = useWorkflowSteps(selectSubstep);
  const variant: PaginationVariant = substep === "review" ? "review" : "workflow";
  const primaryAction = variant === "review" ? handleContinue : returnToReview;

  return (
    <AdCampaignPaginationView
      className={className}
      variant={variant}
      onBack={handleBack}
      onPrimary={primaryAction}
      onSecondary={handleContinue}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      isPending={isPending}
      showPrimaryAction={showPrimaryAction}
      validationFailed={validationFailed}
      onValidationAnimationEnd={clearValidationFailed}
    />
  );
}
