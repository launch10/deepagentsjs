import WebsiteLoader from "@components/website/WebsiteLoader";
import WebsiteSidebar from "@components/website/sidebar/WebsiteSidebar";
import { WebsitePreview } from "@components/website/preview";
import { Chat } from "@components/shared/chat/Chat";
import { PaginationFooter } from "@components/shared/pagination-footer";
import { useEffect, useEffectEvent, useRef, useState, useCallback } from "react";
import { usePage } from "@inertiajs/react";
import {
  useWebsiteChat,
  useWebsiteChatState,
  useWebsiteChatActions,
  useWebsiteChatIsStreaming,
  useWebsiteChatIsInitialLoading,
} from "@hooks/website";

interface WebsitePageProps {
  website?: { id?: number };
  project?: { id?: number; uuid?: string };
  thread_id?: string;
  [key: string]: unknown;
}

/**
 * Auto-initialize the website generation when the page loads.
 * Triggers the default graph flow (website builder) on first load.
 *
 * Uses useEffectEvent pattern from useStageInit to avoid
 * updateState reference changes causing infinite re-renders.
 */
function useWebsiteInit() {
  const { website, project, thread_id } = usePage<WebsitePageProps>().props;
  const websiteId = website?.id;
  const projectId = project?.id;

  const { updateState } = useWebsiteChatActions();
  const isStreaming = useWebsiteChatIsStreaming();
  const chatId = useWebsiteChatState("chatId");
  // thread_id from page props is available immediately (server-rendered),
  // while chatId only populates after history loads. Using both prevents
  // firing updateState on existing chats during the history-loading window.
  const hasInitialized = useRef(!!chatId || !!thread_id);

  const maybeInit = useEffectEvent(() => {
    if (hasInitialized.current) return;
    if (isStreaming) return;
    if (!websiteId || !projectId) return;

    hasInitialized.current = true;
    // No intent = default flow (website builder)
    updateState({
      websiteId,
      projectId,
    });
  });

  useEffect(() => {
    maybeInit();
  }, [websiteId, projectId]);
}

function RestartChatButton() {
  const { website } = usePage<WebsitePageProps>().props;
  const [restarting, setRestarting] = useState(false);

  const handleRestart = useCallback(async () => {
    if (!website?.id) return;
    if (!confirm("Restart chat? This deletes the chat and all checkpoints.")) return;

    setRestarting(true);
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
      await fetch(`/test/websites/${website.id}/restart_chat`, {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": csrfToken || "",
          Accept: "application/json",
        },
      });
      // Full page reload to reset all chat state
      window.location.reload();
    } catch (e) {
      console.error("Failed to restart chat:", e);
      setRestarting(false);
    }
  }, [website?.id]);

  if (!import.meta.env.DEV) return null;

  return (
    <button
      onClick={handleRestart}
      disabled={restarting}
      className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
    >
      {restarting ? "Restarting…" : "Restart Chat (Dev)"}
    </button>
  );
}

/**
 * Website Build step - generates the website content
 */
export default function BuildStep() {
  const chat = useWebsiteChat();
  const isInitialLoading = useWebsiteChatIsInitialLoading();

  // Auto-init website generation on first load
  useWebsiteInit();

  // Credit integration is automatic via ChatProvider - no manual wiring needed
  return (
    <Chat.Root chat={chat}>
      <div className="h-full flex flex-col">
        {/* Main content area - no bottom padding so preview extends behind footer */}
        <main className="flex-1 min-h-0 grid grid-cols-[1fr_3fr] gap-x-[3%] px-[2.5%] pt-[2.5%]">
          {/* Left sidebar */}
          <div className="min-h-0 overflow-hidden">
            <WebsiteSidebar />
          </div>

          {/* Preview content - negative margin extends behind footer, overflow clips rounded corners */}
          <div className="min-h-0 -mb-20 overflow-hidden">
            {isInitialLoading ? (
              <div className="border-[#D3D2D0] border rounded-2xl bg-white flex items-center justify-center h-full">
                <WebsiteLoader />
              </div>
            ) : (
              <WebsitePreview />
            )}
          </div>
        </main>

        {/* Footer - full width background, content aligned with preview */}
        <PaginationFooter.Root layout="full-bleed" isPending={isInitialLoading} canGoBack={false}>
          <PaginationFooter.BackButton />
          <PaginationFooter.Actions>
            <RestartChatButton />
            <PaginationFooter.ActionButton disabled={isInitialLoading}>
              Preview
            </PaginationFooter.ActionButton>
            <PaginationFooter.ContinueButton disabled={isInitialLoading} />
          </PaginationFooter.Actions>
        </PaginationFooter.Root>
      </div>
    </Chat.Root>
  );
}
