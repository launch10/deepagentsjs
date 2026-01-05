import { Button } from "@components/ui/button";
import { twMerge } from "tailwind-merge";
import { Spinner } from "@components/ui/spinner";
import { useAdsChatState } from "@components/ads/hooks";
import { type PaginationFooterViewProps, VARIANT_CONFIG } from "./types";

export function PaginationFooterView({
  className,
  variant = "workflow",
  onBack,
  onPrimary,
  onSecondary,
  canGoBack,
  canGoForward,
  isPending,
  showPrimaryAction,
  primaryLabel,
  secondaryLabel,
  validationFailed,
  onValidationAnimationEnd,
}: PaginationFooterViewProps) {
  const campaignId = useAdsChatState("campaignId");
  const config = VARIANT_CONFIG[variant];

  const resolvedPrimaryLabel = primaryLabel ?? config.primaryLabel;
  const resolvedSecondaryLabel = secondaryLabel ?? config.secondaryLabel;

  const showPrimaryButton = variant !== "workflow" || showPrimaryAction;

  return (
    <div
      className={twMerge(
        "sticky bottom-0 mt-3",
        "bg-background border-t border-neutral-200 py-4 px-6",
        "shadow-[9px_-16px_26.1px_1px_#74767A12]",
        className
      )}
    >
      <div
        className={twMerge(
          "flex items-center",
          config.showPreviousStep ? "justify-between" : "justify-end"
        )}
      >
        {config.showPreviousStep && (
          <Button
            variant="link"
            onClick={onBack}
            disabled={!campaignId || !canGoBack || isPending}
            data-testid="campaign-back-button"
          >
            Previous Step
          </Button>
        )}
        <div className="flex gap-3">
          {config.showSecondaryButton && (
            <Button
              onClick={onSecondary}
              disabled={!campaignId || !canGoForward || isPending}
              className={validationFailed ? "animate-shake" : undefined}
              onAnimationEnd={onValidationAnimationEnd}
              data-testid="campaign-continue-button"
            >
              {isPending && variant === "workflow" && <Spinner />}
              {resolvedSecondaryLabel}
            </Button>
          )}
          {showPrimaryButton && (
            <Button
              onClick={onPrimary}
              disabled={!campaignId || isPending}
              data-testid="campaign-review-button"
            >
              {isPending && variant !== "workflow" && <Spinner />}
              {resolvedPrimaryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
