import { Button } from "@components/ui/button";
import { twMerge } from "tailwind-merge";
import { Spinner } from "@components/ui/spinner";
import { useAdsChatState } from "@hooks/useAdsChat";
import { type AdCampaignPaginationViewProps, VARIANT_CONFIG } from "./AdCampaignPagination.types";

const shakeKeyframes = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
}
`;

export function AdCampaignPaginationView({
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
}: AdCampaignPaginationViewProps) {
  const campaignId = useAdsChatState("campaignId");
  const config = VARIANT_CONFIG[variant];

  const resolvedPrimaryLabel = primaryLabel ?? config.primaryLabel;
  const resolvedSecondaryLabel = secondaryLabel ?? config.secondaryLabel;

  const showPrimaryButton = variant !== "workflow" || showPrimaryAction;

  return (
    <>
      <style>{shakeKeyframes}</style>
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
          <Button variant="link" onClick={onBack} disabled={!campaignId || !canGoBack || isPending}>
            Previous Step
          </Button>
        )}
        <div className="flex gap-3">
          {config.showSecondaryButton && (
            <Button
              onClick={onSecondary}
              disabled={!campaignId || !canGoForward || isPending}
              style={validationFailed ? { animation: "shake 0.5s ease-in-out" } : undefined}
              onAnimationEnd={onValidationAnimationEnd}
            >
              {isPending && variant === "workflow" && <Spinner />}
              {resolvedSecondaryLabel}
            </Button>
          )}
          {showPrimaryButton && (
            <Button onClick={onPrimary} disabled={!campaignId || isPending}>
              {isPending && variant !== "workflow" && <Spinner />}
              {resolvedPrimaryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
