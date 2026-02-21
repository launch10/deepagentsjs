import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button } from "@components/ui/button";

export default function ConnectionErrorScreen() {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-4">
          <ExclamationTriangleIcon className="size-7 text-amber-600" />
        </div>

        <h2 className="text-xl font-semibold text-base-900">
          Unable to connect to the deployment server
        </h2>
        <p className="text-sm text-base-500 mt-2">
          This may be a temporary issue. Your deploy will continue in the
          background.
        </p>

        <Button onClick={() => window.location.reload()} className="mt-6">
          Reload page
        </Button>
      </div>
    </div>
  );
}
