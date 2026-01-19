import WebsiteLoader from "@components/website/WebsiteLoader";
import WebsiteSidebar from "@components/website/sidebar/WebsiteSidebar";
import { WebsitePreview } from "@components/website/preview";
import { Chat } from "@components/shared/chat/Chat";
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
      <main className="mx-auto container max-w-7xl grid grid-cols-[288px_1fr] gap-8 px-8 py-2">
        <div>
          <WebsiteSidebar isLoading={isLoading} currentStep={0} />
        </div>
        <div className="max-w-[948px] h-[calc(100vh-120px)]">
          {isLoading ? (
            <div className="border-[#D3D2D0] border rounded-2xl bg-white flex items-center justify-center h-full">
              <WebsiteLoader steps={websiteLoaderSteps} currentStep={0} />
            </div>
          ) : (
            <WebsitePreview />
          )}
        </div>
      </main>
    </Chat.Root>
  );
}
