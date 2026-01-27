import { Link } from "@inertiajs/react";
import { AlertTriangle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@components/ui/dialog";
import {
  useCreditStore,
  useUsagePercent,
  formatCredits,
} from "~/stores/creditStore";

/**
 * Unified credit modal for both "low credits" and "out of credits" states.
 *
 * Shows when:
 * - User has used >= 80% of plan credits (low variant)
 * - User has exhausted all credits (exhausted variant)
 *
 * Both variants share the same layout: title, description, warning icon,
 * progress bar with remaining count, reset date, and action buttons.
 */
export function CreditWarningModal() {
  const showOutOfCredits = useCreditStore((s) => s.showOutOfCreditsModal);
  const showLowCredit = useCreditStore((s) => s.showLowCreditModal);
  const balance = useCreditStore((s) => s.balance);
  const planCreditsAllocated = useCreditStore((s) => s.planCreditsAllocated);
  const periodEndsAt = useCreditStore((s) => s.periodEndsAt);
  const usagePercent = useUsagePercent();
  const dismissModal = useCreditStore((s) => s.dismissModal);
  const dismissLowCreditWarning = useCreditStore((s) => s.dismissLowCreditWarning);

  const isOpen = showOutOfCredits || showLowCredit;
  const variant: "exhausted" | "low" = showOutOfCredits ? "exhausted" : "low";

  const handleClose = () => {
    if (showOutOfCredits) {
      dismissModal();
    } else {
      dismissLowCreditWarning();
    }
  };

  const title =
    variant === "exhausted"
      ? "You\u2019ve reached your credit limit"
      : "You\u2019re running low on credits";

  const description =
    variant === "exhausted"
      ? "You\u2019ve used all your credits for this billing period. Purchase more or upgrade your plan to continue using AI features."
      : `You\u2019ve used ${usagePercent ?? 0}% of your monthly credits. Purchase more or upgrade your plan to keep creating.`;

  const progressPercent = usagePercent ?? 0;

  const remaining = formatCredits(balance);
  const total = planCreditsAllocated !== null ? formatCredits(planCreditsAllocated) : "\u2014";

  const resetsOnLabel = periodEndsAt
    ? `Resets on ${new Date(periodEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 [&>button]:hidden" data-testid="credit-modal">
        <div className="px-12 pt-8 pb-8">
          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-12 top-9 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Close"
            data-testid="credit-modal-close"
          >
            <X className="h-[18px] w-[18px]" />
          </button>

          {/* Title & description */}
          <DialogTitle className="text-lg font-semibold text-[#0f1113] mb-0.5" data-testid="credit-modal-title">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#74767a] max-w-[460px]">
            {description}
          </DialogDescription>

          {/* Icon */}
          <div className="flex justify-center my-6">
            <div className="h-[60px] w-[60px] rounded-full bg-[#fee9e4] flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-[#8b3523]" />
            </div>
          </div>

          {/* Credits remaining + progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-[#0f1113]">Credits Remaining</span>
              <span className="text-xs text-[#2e3238]" data-testid="credit-modal-balance">
                {remaining}/{total}
              </span>
            </div>
            <div className="h-[6px] w-full rounded-full bg-[#ededec] overflow-hidden" data-testid="credit-modal-progress">
              <div
                className="h-full rounded-full transition-all bg-gradient-to-r from-[#ea9e86] to-[#ba543e]"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
            {resetsOnLabel && (
              <p className="text-xs text-[#96989b] mt-1.5">{resetsOnLabel}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-4">
            <Link
              href="/subscriptions"
              className="text-base text-[#2e3238] hover:opacity-80 transition-opacity py-3 px-3"
            >
              Upgrade Plan
            </Link>
            <Link
              href="/subscriptions"
              className="text-base text-white bg-[#2e3238] border border-[#2e3238] rounded-lg py-3 px-3 hover:opacity-90 transition-opacity"
            >
              Purchase Credits
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
