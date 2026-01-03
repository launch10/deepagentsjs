/**
 * CampaignDeploy - Placeholder component demonstrating the async job polling pattern
 *
 * This component shows how to use the useDeployStatus hook with the
 * fire-and-forget + idempotent node pattern described in langgraph-rails-pattern.md
 *
 * Flow:
 * 1. User clicks "Deploy Campaign"
 * 2. Graph fires Rails job, returns { pending }
 * 3. Frontend polls every 3s while pending && !streaming
 * 4. Webhook delivers result, next poll sees { completed }
 * 5. Frontend stops polling, shows success
 *
 * NOTE: This is a placeholder demonstrating the pattern. To integrate:
 * 1. Create a useLaunchChat hook similar to useAdsChat
 * 2. Add deployStatus, deployResult to LaunchGraphState (already done in backend)
 * 3. Wire up the component to the Launch graph
 *
 * @see /plans/langgraph-rails-pattern.md for full pattern documentation
 */

import { useCallback, useState } from "react";
import { useDeployStatus } from "@hooks/useDeployStatus";

// Placeholder types - replace with actual LaunchGraphState when integrating
interface DeployState {
  deployStatus?: "pending" | "completed" | "failed";
  deployResult?: Record<string, unknown>;
  error?: { message: string; node: string };
  campaignId?: number;
}

interface CampaignDeployProps {
  /** Current state from the Launch graph */
  state: DeployState;
  /** Whether the chat is currently streaming a response */
  isStreaming: boolean;
  /** Function to send a message to the graph */
  sendMessage: (message: { content: string; metadata?: Record<string, unknown> }) => void;
}

export default function CampaignDeploy({ state, isStreaming, sendMessage }: CampaignDeployProps) {
  // Callback to send a "check" message for polling
  const sendCheck = useCallback(() => {
    sendMessage({ content: "", metadata: { check: true } });
  }, [sendMessage]);

  // Use the deploy status hook for automatic polling
  const { isPending, isComplete, isFailed, isPolling } = useDeployStatus({
    deployStatus: state.deployStatus,
    isStreaming,
    sendCheck,
  });

  // Handle deploy button click
  const handleDeploy = useCallback(() => {
    sendMessage({
      content: "Deploy campaign",
      metadata: { command: "deploy", campaignId: state.campaignId },
    });
  }, [sendMessage, state.campaignId]);

  // Render based on deploy status
  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        <p className="text-base-600">
          Deploying campaign...
          {isPolling && <span className="text-base-400 text-sm ml-2">(checking status)</span>}
        </p>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="rounded-full h-12 w-12 bg-green-100 flex items-center justify-center">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-green-700 font-medium">Campaign deployed successfully!</p>
        {state.deployResult && (
          <pre className="text-xs text-base-500 bg-base-50 p-4 rounded-lg max-w-md overflow-auto">
            {JSON.stringify(state.deployResult, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-red-700 font-medium">Deploy failed</p>
        {state.error && <p className="text-sm text-red-600">{state.error.message}</p>}
        <button
          onClick={handleDeploy}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Retry Deploy
        </button>
      </div>
    );
  }

  // Default: show deploy button
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <p className="text-base-600">Ready to deploy your campaign to Google Ads</p>
      <button
        onClick={handleDeploy}
        disabled={isStreaming}
        className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isStreaming ? "Processing..." : "Deploy Campaign"}
      </button>
    </div>
  );
}

/**
 * Example usage with a real Launch chat hook:
 *
 * ```tsx
 * function LaunchPage() {
 *   const { state, status, actions } = useLaunchChat();
 *
 *   return (
 *     <CampaignDeploy
 *       state={state}
 *       isStreaming={status === "streaming" || status === "submitted"}
 *       sendMessage={actions.submit}
 *     />
 *   );
 * }
 * ```
 */
