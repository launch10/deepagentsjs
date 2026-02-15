import { useState } from "react";
import { ExclamationTriangleIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { Button } from "@components/ui/button";
import { Deploy } from "@shared";
import { useDeployChatState, useDeployNewDeploy } from "@hooks/useDeployChat";

export default function DeployErrorScreen() {
  const error = useDeployChatState("error");
  const consoleErrors = useDeployChatState("consoleErrors");
  const supportTicket = useDeployChatState("supportTicket");
  const { trigger: handleRetry, isLoading: retrying } = useDeployNewDeploy();

  const [showDetails, setShowDetails] = useState(false);
  const deployError = Deploy.getDeployError(error?.message, error?.node);
  const hasRawDetails = error?.message || (consoleErrors && consoleErrors.length > 0);

  return (
    <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <ExclamationTriangleIcon className="size-7 text-red-600" />
        </div>

        <h2 className="text-xl font-semibold text-base-900">{deployError.title}</h2>
        <p className="text-sm text-base-500 mt-2">{deployError.message}</p>

        {hasRawDetails && (
          <div className="mt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-1 text-xs text-base-400 hover:text-base-500"
            >
              <ChevronDownIcon
                className={`size-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`}
              />
              Technical details
            </button>
            {showDetails && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                {error?.message && <p className="text-xs text-red-600">{error.message}</p>}
                {consoleErrors?.map((err, i) => (
                  <p key={i} className="text-xs text-red-600 mt-1">
                    {err.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {supportTicket && (
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center">
            <p className="text-sm font-medium text-blue-800">
              We've been notified and are looking into this
            </p>
            <p className="mt-1 text-xs text-blue-600">Reference: {supportTicket}</p>
          </div>
        )}

        {deployError.canRetry && (
          <Button
            onClick={handleRetry}
            disabled={retrying}
            variant={supportTicket ? "outline" : "default"}
            className="mt-6"
          >
            {retrying ? "Retrying…" : "Retry Deploy"}
          </Button>
        )}
      </div>
    </div>
  );
}
