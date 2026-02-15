import { ClockIcon } from "@heroicons/react/24/outline";
import { Button } from "@components/ui/button";
import { useDeployChatActions } from "@hooks/useDeployChat";

export default function WaitingGoogleScreen() {
  const { updateState } = useDeployChatActions();

  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
          <ClockIcon className="size-7 text-base-500" />
        </div>

        <h2 className="text-lg font-medium text-base-900">Waiting for Google to confirm</h2>
        <p className="text-sm text-base-500 mt-2">
          Google is still processing your account setup. This can take a few minutes.
        </p>

        <Button variant="outline" className="mt-6" onClick={() => updateState({})}>
          Check Again
        </Button>
      </div>
    </div>
  );
}
