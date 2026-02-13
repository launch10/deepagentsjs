import { useState, useEffect, useCallback, useRef } from "react";
import { useWebsitePreview, useWebsiteChatActions } from "@hooks/website";
import { useChatIsStreaming } from "@components/shared/chat/ChatContext";
import { StepProgress } from "@components/ui/step-progress";
import { type WebContainerStatus, WebContainerManager } from "@lib/webcontainer";
import { useCurrentUser } from "@stores/sessionStore";
import { useProjectUuid } from "@stores/projectStore";
import { analytics } from "@lib/analytics";

const previewSteps = [
  { id: "booting", label: "Starting preview environment..." },
  { id: "mounting", label: "Loading files..." },
  { id: "installing", label: "Installing dependencies..." },
  { id: "starting", label: "Starting preview server..." },
];

const statusToStepIndex: Record<WebContainerStatus, number> = {
  idle: 0,
  booting: 0,
  mounting: 1,
  installing: 2,
  starting: 3,
  ready: 4,
  error: 0,
};

interface StatusMessageProps {
  status: WebContainerStatus;
  hasBuildErrors?: boolean;
  onFix?: () => void;
}

function StatusMessage({ status, hasBuildErrors, onFix }: StatusMessageProps) {
  if (hasBuildErrors) {
    return (
      <div
        data-testid="preview-status"
        data-status="build-error"
        className="flex flex-col items-center gap-3 text-center px-8"
      >
        <div className="size-10 rounded-full bg-red-100 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-red-500"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
        </div>
        <p className="text-sm font-medium text-neutral-700">We had an issue building your page</p>
        <button
          onClick={onFix}
          className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Fix errors
        </button>
      </div>
    );
  }

  const currentStep = statusToStepIndex[status] ?? 0;

  return (
    <div data-testid="preview-status" data-status={status}>
      <StepProgress title="Loading your preview" steps={previewSteps} currentStep={currentStep} />
    </div>
  );
}

interface ErrorMessageProps {
  error: string;
  onRetry?: () => void;
}

function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <div className="text-red-500 text-4xl">!</div>
      <p className="text-red-600 text-sm text-center max-w-md">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Preview component that displays the landing page in an iframe.
 * Uses WebContainer to run a dev server and display the preview.
 */
export function WebsitePreview() {
  const { previewUrl, status, error, consoleErrors, reload } = useWebsitePreview();
  const { sendMessage } = useWebsiteChatActions();
  const isStreaming = useChatIsStreaming();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.admin ?? false;
  const projectUuid = useProjectUuid();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const hasTrackedPreview = useRef(false);

  // Reset iframeLoaded when previewUrl changes (e.g. WebContainer restart)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn("[WebsitePreview] previewUrl changed, resetting iframeLoaded", { previewUrl });
    }
    setIframeLoaded(false);
    hasTrackedPreview.current = false;
  }, [previewUrl]);

  // Listen for postMessage from the preview iframe signaling content has rendered.
  // If the page rendered successfully, clear any stale build errors — they were
  // transient (e.g. missing imports during incremental file writes).
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "preview-ready") {
        if (import.meta.env.DEV) {
          console.warn("[WebsitePreview] preview-ready received — iframeLoaded: true");
        }
        setIframeLoaded(true);
        if (projectUuid && !hasTrackedPreview.current) {
          hasTrackedPreview.current = true;
          analytics.trackProject("website_previewed", projectUuid);
        }
        if (consoleErrors.length > 0) {
          WebContainerManager.clearConsoleErrors();
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [consoleErrors.length, projectUuid]);

  const handleReload = useCallback(() => {
    setIframeLoaded(false);
    reload();
  }, [reload]);

  const buildErrors = consoleErrors.filter((e) => e.type === "error");

  const handleFixErrors = useCallback(() => {
    sendMessage("My page isn't displaying correctly, can you fix it?", {
      consoleErrors: buildErrors,
    });
    if (projectUuid)
      analytics.trackProject("website_edited", projectUuid, { edit_type: "error_fix" });
  }, [buildErrors, sendMessage, projectUuid]);

  // Show error state
  if (status === "error") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-50 rounded-2xl border border-neutral-200">
        <ErrorMessage error={error || "Unknown error"} onRetry={handleReload} />
      </div>
    );
  }

  const hasBuildErrors = buildErrors.length > 0;
  const isReady = status === "ready";
  const showLoading = !isReady || !iframeLoaded;

  if (import.meta.env.DEV) {
    console.warn("[WebsitePreview] render", {
      isReady,
      iframeLoaded,
      showLoading,
      status,
      hasBuildErrors,
      iframeMounted: isReady && !!previewUrl,
    });
  }

  // Show preview iframe (behind loading overlay when not yet loaded)
  return (
    <div
      className="w-full h-full flex flex-col rounded-2xl border border-neutral-200 overflow-hidden"
      data-testid="preview-container"
    >
      {/* Preview header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-neutral-100 border-b border-neutral-200">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-2">
          <div className="bg-white rounded-md px-3 py-1 text-xs text-neutral-500 truncate">
            {previewUrl || "Loading..."}
          </div>
        </div>
        <button
          onClick={handleReload}
          className="p-1 hover:bg-neutral-200 rounded transition-colors"
          title="Reload preview"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-neutral-600"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
        </button>
      </div>

      {/* Preview content area */}
      <div className="flex-1 relative bg-white">
        {/* Loading overlay — shows build error state or normal loading steps */}
        {(showLoading || (hasBuildErrors && !isStreaming)) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-50">
            <StatusMessage
              status={status}
              hasBuildErrors={hasBuildErrors && !isStreaming}
              onFix={handleFixErrors}
            />
          </div>
        )}

        {/* Iframe - rendered once ready, loads behind the overlay */}
        {isReady && previewUrl && (
          <iframe
            src={previewUrl}
            className="w-full h-full border-none"
            title="Website Preview"
            data-testid="preview-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </div>
  );
}
