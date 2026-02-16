import { Spinner } from "@components/ui/spinner";
import FullResetButton from "@components/deploy/FullResetButton";

export default function CheckingPaymentScreen() {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <Spinner className="size-8 text-primary-500" />
      <h2 className="text-lg font-medium text-base-900 mt-4">Checking payment status</h2>
      <p className="text-sm text-base-500 mt-2">Verifying your payment method with Google...</p>
      <div className="mt-4">
        <FullResetButton />
      </div>
    </div>
  );
}
