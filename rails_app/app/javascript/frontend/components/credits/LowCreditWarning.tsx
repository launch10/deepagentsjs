import { Link } from "@inertiajs/react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@components/ui/button";
import {
  useCreditStore,
  useShowLowCreditWarning,
  useUsagePercent,
  formatCredits,
} from "~/stores/creditStore";

/**
 * Banner warning shown when credit usage exceeds 80%.
 *
 * Features:
 * - Shows usage percentage and remaining credits
 * - Links to purchase more credits or view usage
 * - Dismissable for 24 hours
 * - Does not show if user is already out of credits (separate modal)
 */
export function LowCreditWarning() {
  const shouldShow = useShowLowCreditWarning();
  const usagePercent = useUsagePercent();
  const balance = useCreditStore((s) => s.balance);
  const dismissWarning = useCreditStore((s) => s.dismissLowCreditWarning);

  if (!shouldShow) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3" data-testid="low-credit-warning">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-medium">Running low on credits.</span>{" "}
            You&apos;ve used {usagePercent}% of your plan credits.{" "}
            <span className="font-medium">{formatCredits(balance)} credits</span> remaining.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button asChild size="sm" variant="outline" className="h-8">
            <Link href="/subscriptions">Purchase Credits</Link>
          </Button>

          <button
            type="button"
            onClick={dismissWarning}
            className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded transition-colors"
            aria-label="Dismiss warning"
            data-testid="low-credit-warning-dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
