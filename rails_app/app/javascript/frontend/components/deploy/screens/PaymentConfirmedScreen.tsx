import { CheckCircleIcon } from "@heroicons/react/24/solid";

export default function PaymentConfirmedScreen() {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
        <CheckCircleIcon className="size-10 text-success-500" />
      </div>
      <h2 className="text-lg font-medium text-base-900 mt-4">Payment method confirmed</h2>
      <p className="text-sm text-base-500 mt-2">Continuing deployment...</p>
    </div>
  );
}
