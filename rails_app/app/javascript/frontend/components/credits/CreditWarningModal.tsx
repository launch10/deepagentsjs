import { Link } from "@inertiajs/react";
import { X } from "lucide-react";
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

  // Variant-specific colors
  const circleBg = variant === "exhausted" ? "bg-[#fee9e4]" : "bg-[#faecdb]";
  const iconFill = variant === "exhausted" ? "#8B3523" : "#BF873F";
  const barGradient =
    variant === "exhausted"
      ? "bg-gradient-to-r from-[#ea9e86] to-[#ba543e]"
      : "bg-gradient-to-r from-[#f2d0a5] to-[#e5a24c]";

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
            <div className={`h-[60px] w-[60px] rounded-full ${circleBg} flex items-center justify-center`}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M10.9677 3.50488C12.3146 1.17025 15.6841 1.17025 17.031 3.50488L25.611 18.377C26.9572 20.7103 25.2732 23.626 22.5794 23.626H5.41928C2.72548 23.626 1.04148 20.7103 2.38763 18.377L10.9677 3.50488ZM13.9996 9.62592C14.4828 9.62592 14.8746 10.0177 14.8746 10.5009V14.8759C14.8746 15.3592 14.4828 15.7509 13.9996 15.7509C13.5163 15.7509 13.1246 15.3592 13.1246 14.8759V10.5009C13.1246 10.0177 13.5163 9.62592 13.9996 9.62592ZM13.9996 19.2509C14.4828 19.2509 14.8746 18.8592 14.8746 18.3759C14.8746 17.8927 14.4828 17.5009 13.9996 17.5009C13.5163 17.5009 13.1246 17.8927 13.1246 18.3759C13.1246 18.8592 13.5163 19.2509 13.9996 19.2509Z" fill={iconFill}/>
              </svg>
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
                className={`h-full rounded-full transition-all ${barGradient}`}
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
