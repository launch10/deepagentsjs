import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Progress } from "@components/ui/progress";
import { CreditCardIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

interface BillingCreditsSectionProps {
  creditBalance: {
    plan_credits: number;
    pack_credits: number;
    total_credits: number;
    plan_credit_limit: number;
    reset_date?: string | null;
  };
  stripePortalUrl?: string | null;
}

export function BillingCreditsSection({
  creditBalance,
  stripePortalUrl,
}: BillingCreditsSectionProps) {
  // Calculate usage percentage based on plan credits used
  const creditsUsed = creditBalance.plan_credit_limit - creditBalance.plan_credits;
  const usagePercentage =
    creditBalance.plan_credit_limit > 0
      ? Math.round((Math.max(0, creditsUsed) / creditBalance.plan_credit_limit) * 100)
      : 0;

  const handleStripePortal = () => {
    if (stripePortalUrl) {
      window.location.href = stripePortalUrl;
    }
  };

  const handlePurchaseCredits = () => {
    // TODO: Redirect to Stripe customer portal for credit purchase
  };

  return (
    <Card className="border-[#D3D2D0] rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF5F3]">
            <CreditCardIcon className="h-4 w-4 text-[#375E56]" />
          </div>
          <CardTitle className="font-['Plus_Jakarta_Sans'] text-lg font-semibold text-[#2E3238]">
            Billing & Credits
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Credit Usage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#0F1113]">
              Credit Usage
            </span>
            <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#2E3238]">
              {Math.max(0, creditsUsed).toLocaleString()} /{" "}
              {creditBalance.plan_credit_limit.toLocaleString()}
            </span>
          </div>
          <Progress value={usagePercentage} className="h-3.5" />
          {creditBalance.reset_date && (
            <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#96989B]">
              Resets on {creditBalance.reset_date}
            </p>
          )}
        </div>

        {/* Purchase Credits Button */}
        <Button
          onClick={handlePurchaseCredits}
          className="w-full bg-[#3748B8] hover:bg-[#2d3a9a] text-white font-['Plus_Jakarta_Sans'] text-base"
        >
          Purchase Credits
        </Button>

        {/* Stripe Portal Links */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={handleStripePortal}
            className="flex items-center gap-2 font-['Plus_Jakarta_Sans'] text-sm text-[#2E3238] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!stripePortalUrl}
          >
            Update Payment Method
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleStripePortal}
            className="flex items-center gap-2 font-['Plus_Jakarta_Sans'] text-sm text-[#2E3238] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!stripePortalUrl}
          >
            View Billing History
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
