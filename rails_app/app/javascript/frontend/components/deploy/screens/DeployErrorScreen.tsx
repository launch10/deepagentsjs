import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button } from "@components/ui/button";

interface DeployErrorScreenProps {
  error?: string;
  consoleErrors?: Array<{ message: string }>;
  onRetry: () => void;
}

export default function DeployErrorScreen({
  error,
  consoleErrors,
  onRetry,
}: DeployErrorScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <ExclamationTriangleIcon className="size-7 text-red-600" />
        </div>

        <h2 className="text-xl font-semibold text-base-900">Deploy Failed</h2>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        {consoleErrors && consoleErrors.length > 0 && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-left">
            {consoleErrors.map((err, i) => (
              <p key={i} className="text-xs text-red-600">
                {err.message}
              </p>
            ))}
          </div>
        )}

        <Button onClick={onRetry} className="mt-6">
          Retry Deploy
        </Button>
      </div>
    </div>
  );
}
