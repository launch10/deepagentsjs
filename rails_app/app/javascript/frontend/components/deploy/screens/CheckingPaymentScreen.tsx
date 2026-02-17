import { usePage } from "@inertiajs/react";
import { CreditCardIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { Button } from "@components/ui/button";
import FullResetButton from "@components/deploy/FullResetButton";
import { useDeployChatActions, type DeployProps } from "@hooks/useDeployChat";

export interface CheckingPaymentViewProps {
  billingUrl: string;
  onPaymentAdded?: () => void;
}

/** Pure presentational component — no hooks, fully testable in Storybook */
export function CheckingPaymentView({
  billingUrl,
  onPaymentAdded,
}: CheckingPaymentViewProps) {
  return (
    <div className="flex flex-col h-full p-10">
      {/* Header — top-left aligned */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-base-500">
            Google Payment Setup
          </h2>
          <p className="text-xs text-base-300">
            Add a card to activate your campaign. You are only charged by Google for actual ad spend.
          </p>
        </div>
        <FullResetButton />
      </div>

      {/* Centered content — fills remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center mx-auto w-full max-w-[506px]">
        {/* Payment card */}
        <div className="w-full border border-neutral-200 rounded-lg bg-white flex flex-col gap-5 px-[30px] py-[26px]">
          {/* Payment required + badge */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <CreditCardIcon className="size-7 text-base-300 shrink-0" />
              <span className="font-semibold text-base-300">Payment Required in Google</span>
            </div>
            <span className="shrink-0 rounded-full bg-[#faecdb] px-3 py-1 text-xs text-[#bf873f]">
              External action needed
            </span>
          </div>

          {/* What to do */}
          <div className="bg-neutral-50 rounded-lg p-5 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-base-600">What to do</h3>
            <ol className="flex flex-col gap-2 list-decimal list-inside text-sm text-base-600">
              <li>Click button to open Google Ads</li>
              <li>Add your preferred payment method</li>
              <li className="font-semibold">Return here, we&apos;ll verify automatically</li>
            </ol>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-5 w-full">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => window.open(billingUrl, "_blank")}
          >
            <ArrowTopRightOnSquareIcon className="size-4" />
            Add Payment Method
          </Button>
          <Button
            className="flex-1 bg-base-500 text-white hover:bg-base-600 border-base-500"
            onClick={onPaymentAdded}
          >
            Payment Method Added
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Connected component — reads from deploy chat state */
export default function CheckingPaymentScreen() {
  const { updateState } = useDeployChatActions();
  const { ads_account } = usePage<DeployProps>().props;

  const customerId = ads_account?.platform_settings?.google?.customer_id?.replace(/-/g, "");
  const billingUrl = customerId
    ? `https://ads.google.com/aw/billing/payments?ocid=${customerId}`
    : "https://ads.google.com/aw/billing/payments";

  return (
    <CheckingPaymentView
      billingUrl={billingUrl}
      onPaymentAdded={() =>
        updateState({
          tasks: [{ name: "CheckingBilling", result: { has_payment: true } }],
        })
      }
    />
  );
}
