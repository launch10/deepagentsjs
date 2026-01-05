import { PaginationFooterView } from "./PaginationFooterView";
import { usePaginationFooter } from "./usePaginationFooter";
import { selectSubstep, useWorkflow } from "@context/WorkflowProvider";
import type { PaginationVariant } from "./types";

interface PaginationFooterProps {
  className?: string;
}

export default function PaginationFooter({ className }: PaginationFooterProps) {
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
  } = usePaginationFooter();

  const substep = useWorkflow(selectSubstep);
  const variant: PaginationVariant = substep === "review" ? "review" : "workflow";
  const primaryAction = variant === "review" ? handleContinue : returnToReview;

  return (
    <PaginationFooterView
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
