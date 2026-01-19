import { useWebsitePreview } from "@hooks/website";
import LogoSpinner from "@components/ui/logo-spinner";
import type { WebContainerStatus } from "@lib/webcontainer";

interface StatusMessageProps {
  status: WebContainerStatus;
}

function StatusMessage({ status }: StatusMessageProps) {
  const messages: Record<WebContainerStatus, string> = {
    idle: "Waiting for files...",
    booting: "Starting preview environment...",
    mounting: "Loading files...",
    installing: "Installing dependencies...",
    starting: "Starting preview server...",
    ready: "Preview ready",
    error: "Preview failed to load",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4" data-testid="preview-status">
      {status !== "error" && status !== "ready" && (
        <div className="w-16 h-16">
          <LogoSpinner />
        </div>
      )}
      <p className="text-neutral-600 text-sm" data-testid={`preview-status-${status}`}>
        {messages[status]}
      </p>
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
  const { previewUrl, status, error, reload } = useWebsitePreview();

  // Show loading state while WebContainer is initializing
  if (status !== "ready" && status !== "error") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-50 rounded-2xl border border-neutral-200">
        <StatusMessage status={status} />
      </div>
    );
  }

  // Show error state
  if (status === "error") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-50 rounded-2xl border border-neutral-200">
        <ErrorMessage error={error || "Unknown error"} onRetry={reload} />
      </div>
    );
  }

  // Show preview iframe
  return (
    <div className="w-full h-full flex flex-col rounded-2xl border border-neutral-200 overflow-hidden" data-testid="preview-container">
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
          onClick={reload}
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

      {/* Preview iframe */}
      <div className="flex-1 bg-white">
        {previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full h-full border-none"
            title="Website Preview"
            data-testid="preview-iframe"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <StatusMessage status="idle" />
          </div>
        )}
      </div>
    </div>
  );
}
