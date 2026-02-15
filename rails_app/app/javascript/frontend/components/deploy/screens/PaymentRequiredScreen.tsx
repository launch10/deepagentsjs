import { usePage } from "@inertiajs/react";
import { CreditCardIcon } from "@heroicons/react/24/outline";
import { Button } from "@components/ui/button";
import { useDeployChatActions, type DeployProps } from "@hooks/useDeployChat";

export default function PaymentRequiredScreen() {
  const { updateState } = useDeployChatActions();
  const { ads_account } = usePage<DeployProps>().props;

  const customerId = ads_account?.platform_settings?.google?.customer_id?.replace(/-/g, "");
  const billingUrl = customerId
    ? `https://ads.google.com/aw/billing/payments?ocid=${customerId}`
    : "https://ads.google.com/aw/billing/payments";

  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="max-w-md w-full text-center">
        <span className="inline-block text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mb-4">
          External action needed
        </span>

        <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
          <CreditCardIcon className="size-7 text-amber-600" />
        </div>

        <h2 className="text-xl font-semibold text-base-900">Add Payment Method</h2>
        <p className="text-sm text-base-500 mt-2">
          Google requires a valid payment method to run your ads campaign. Please add a payment
          method in Google Ads, then come back here.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
          <Button variant="outline" onClick={() => window.open(billingUrl, "_blank")}>
            Add Payment Method
          </Button>
          <Button onClick={() => updateState({})}>Payment Method Added</Button>
        </div>
      </div>
    </div>
  );
}
