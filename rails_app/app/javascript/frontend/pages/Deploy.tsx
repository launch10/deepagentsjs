import { useEffect, useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { PhaseProgress, type Phase } from "@components/deploy";
import LogoSpinner from "@components/ui/logo-spinner";
import WorkflowPanel from "@components/ads/WorkflowPanel";
import { useDeployChatWithPolling, type DeployProps } from "@hooks/useDeployChat";

export default function Deploy() {
  const { deploy } = usePage<DeployProps>().props;
  const { state, isLoading, isPolling, error, startDeploy } = useDeployChatWithPolling();

  // Auto-start deploy if it's a new deploy (pending status, no thread)
  useEffect(() => {
    if (deploy.status === "pending" && !deploy.langgraph_thread_id) {
      startDeploy();
    }
  }, [deploy.status, deploy.langgraph_thread_id, startDeploy]);

  const isPending = state.status === "pending" || state.status === "running" || isLoading;
  const isComplete = state.status === "completed";
  const isFailed = state.status === "failed";

  // Check if OAuth is required
  const oauthTask = state.tasks?.find(
    (t) => t.name === "ConnectingGoogle" && t.result?.action === "oauth_required"
  );
  const needsOAuth = oauthTask && oauthTask.status === "running" && !oauthTask.result?.google_email;

  // Check if invite is pending
  const inviteTask = state.tasks?.find(
    (t) => t.name === "VerifyingGoogle" && t.status === "running"
  );
  const awaitingInvite = inviteTask && !inviteTask.result?.status;

  // Transform state.phases to match Phase interface
  const phases: Phase[] = useMemo(() => {
    if (!state.phases) return [];
    return state.phases.map((p, index) => ({
      id: p.name,
      name: p.label,
      description: p.statusLabel || "",
      status: p.status,
      progress: p.status === "completed" ? 100 : p.status === "running" ? 50 : 0,
    }));
  }, [state.phases]);

  return (
    <main className="mx-auto container max-w-7xl grid grid-cols-[288px_1fr] gap-8 px-8">
      <div>
        <WorkflowPanel />
      </div>
      <div className="max-w-[948px]">
        <div className="border border-neutral-300 bg-white p-6 rounded-2xl">
          <div className="py-8 px-9 flex flex-col gap-6">
            <h1 className="text-2xl font-semibold text-base-900">Deploy Your Campaign</h1>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700">{error.message || String(error)}</p>
                <button
                  onClick={startDeploy}
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            )}

            {needsOAuth && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <h2 className="text-lg font-medium text-blue-900 mb-2">
                  Connect Your Google Account
                </h2>
                <p className="text-blue-700 mb-4">
                  To deploy your Google Ads campaign, we need to connect your Google account.
                </p>
                <a
                  href={`/auth/google_oauth2?redirect_to=${encodeURIComponent(window.location.href)}`}
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Connect with Google
                </a>
              </div>
            )}

            {awaitingInvite && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <h2 className="text-lg font-medium text-yellow-900 mb-2">
                  Accept Google Ads Invitation
                </h2>
                <p className="text-yellow-700 mb-4">
                  We&apos;ve sent an invitation to your email. Please check your inbox and accept
                  the invitation to continue.
                </p>
                <div className="flex items-center justify-center gap-2 text-yellow-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600" />
                  <span>Waiting for acceptance...</span>
                </div>
              </div>
            )}

            {isPending && !needsOAuth && !awaitingInvite && (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <LogoSpinner />
                <p className="text-base-600">
                  Deploying your campaign...
                  {isPolling && (
                    <span className="text-base-400 text-sm ml-2">(checking status)</span>
                  )}
                </p>
              </div>
            )}

            {phases.length > 0 && (
              <PhaseProgress phases={phases} showOnlyActive={false} className="w-full" />
            )}

            {isComplete && (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="rounded-full h-12 w-12 bg-green-100 flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-green-700 font-medium">Campaign deployed successfully!</p>
                {state.result && (
                  <pre className="text-xs text-base-500 bg-base-50 p-4 rounded-lg max-w-md overflow-auto">
                    {JSON.stringify(state.result, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {isFailed && (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <p className="text-red-700 font-medium">Deploy failed</p>
                {state.consoleErrors && state.consoleErrors.length > 0 && (
                  <div className="text-sm text-red-600 max-w-md">
                    {state.consoleErrors.map((err, i) => (
                      <p key={i}>{err.message}</p>
                    ))}
                  </div>
                )}
                <button
                  onClick={startDeploy}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Retry Deploy
                </button>
              </div>
            )}

            {!isPending && !isComplete && !isFailed && !needsOAuth && !awaitingInvite && (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <p className="text-base-600">Ready to deploy your campaign</p>
                <button
                  onClick={startDeploy}
                  disabled={isLoading}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {isLoading ? "Deploying..." : "Deploy Campaign"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
