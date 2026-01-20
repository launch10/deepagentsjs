import WebsiteLoader from "@components/website/WebsiteLoader";
import WebsiteSidebar from "@components/website/sidebar/WebsiteSidebar";
import { WebsitePreview } from "@components/website/preview";
import { Chat } from "@components/shared/chat/Chat";
import { Button } from "@components/ui/button";
import { twMerge } from "tailwind-merge";
import { useEffect, useEffectEvent, useRef } from "react";
import { usePage } from "@inertiajs/react";
import {
  useWebsiteChat,
  useWebsiteChatState,
  useWebsiteChatIsLoadingHistory,
  useWebsiteChatActions,
  useWebsiteSendMessage,
  useWebsiteChatIsStreaming,
} from "@hooks/website";
import type { InertiaProps } from "@shared";

type WebsitePageProps =
  InertiaProps.paths["/projects/{uuid}/website"]["get"]["responses"]["200"]["content"]["application/json"];

const websiteLoaderSteps = [{ id: "1", label: "Setting up branding & colors" }];

/**
 * Website-specific pagination footer with disabled/muted styling.
 * Shows "Previous Step", "Preview", and "Continue" buttons in a faded state
 * while the website is being generated.
 *
 * Note: This is a standalone component that doesn't use the shared
 * PaginationFooterView because that component has Ads-specific hooks.
 */
function WebsitePaginationFooter({ isLoading }: { isLoading: boolean }) {
  return (
    <div
      className={twMerge(
        "sticky bottom-0 mt-3",
        "bg-background border-t border-neutral-200 py-4 px-6",
        "shadow-[9px_-16px_26.1px_1px_#74767A12]",
        isLoading && "opacity-50 pointer-events-none"
      )}
    >
      <div className="flex items-center justify-between">
        <Button variant="link" disabled>
          Previous Step
        </Button>
        <div className="flex gap-3">
          <Button disabled>Preview</Button>
          <Button disabled>Continue</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Auto-initialize the website generation when the page loads.
 * Sends command: "create" to langgraph on first load.
 *
 * Uses useEffectEvent pattern from useStageInit to avoid
 * updateState reference changes causing infinite re-renders.
 */
function useWebsiteInit() {
  const { website, project } = usePage<WebsitePageProps>().props;
  const projectId = project?.id!;
  const { updateState } = useWebsiteChatActions();
  const isStreaming = useWebsiteChatIsStreaming();
  const chatId = useWebsiteChatState("chatId");
  const hasInitialized = useRef(!!chatId);

  const maybeInit = useEffectEvent(() => {
    // Only initialize once, and only if status is pending (no generation started)
    if (hasInitialized.current) return;
    if (isStreaming) return;
    if (!website?.id) return;

    hasInitialized.current = true;
    updateState({
      command: "create",
      websiteId: website.id,
      projectId,
    });
  });

  useEffect(() => {
    maybeInit();
  }, [website?.id, projectId]);
}

export default function Website() {
  const chat = useWebsiteChat();
  const { sendMessage } = useWebsiteSendMessage();
  const status = useWebsiteChatState("status");
  const isLoadingHistory = useWebsiteChatIsLoadingHistory();
  const isStreaming = useWebsiteChatIsStreaming();

  // Auto-init website generation on first load
  useWebsiteInit();

  // Show loading when:
  // 1. Loading chat history from server
  // 2. Sending message
  const isLoading = isLoadingHistory || isStreaming;

  return (
    <Chat.Root chat={chat} onSubmit={sendMessage}>
      <div className="h-full flex flex-col">
        <main className="flex-1 min-h-0 flex gap-14 pl-[72px] pr-[76px] py-3">
          {/* Left sidebar - fixed width */}
          <div className="w-[288px] shrink-0 self-stretch">
            <WebsiteSidebar isLoading={isLoading} currentStep={0} />
          </div>

          {/* Main preview area - fills remaining space */}
          <div className="flex-1 min-w-0 self-stretch">
            {isLoading ? (
              <div className="border-[#D3D2D0] border rounded-2xl bg-white flex items-center justify-center h-full">
                <WebsiteLoader steps={websiteLoaderSteps} currentStep={0} />
              </div>
            ) : (
              <WebsitePreview />
            )}
          </div>
        </main>

        <WebsitePaginationFooter isLoading={isLoading} />
      </div>
    </Chat.Root>
  );
}
