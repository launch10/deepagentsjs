import WebsiteLoader from "@components/website/WebsiteLoader";
import WebsiteSidebar from "@components/website/sidebar/WebsiteSidebar";
import { WebsitePreview } from "@components/website/preview";
import { Chat } from "@components/shared/chat/Chat";
import { PaginationFooter } from "@components/shared/pagination-footer";
import { useEffect, useEffectEvent, useRef, useCallback } from "react";
import { usePage, router } from "@inertiajs/react";
import {
  useWebsiteChat,
  useWebsiteChatState,
  useWebsiteChatActions,
  useWebsiteChatIsLoadingHistory,
  useWebsiteChatIsStreaming,
} from "@hooks/website";

interface WebsitePageProps {
  website?: { id?: number };
  project?: { id?: number; uuid?: string };
  [key: string]: unknown;
}

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
  const websiteId = website?.id;
  const projectId = project?.id;

  const { updateState } = useWebsiteChatActions();
  const isStreaming = useWebsiteChatIsStreaming();
  const chatId = useWebsiteChatState("chatId");
  const hasInitialized = useRef(!!chatId);

  const maybeInit = useEffectEvent(() => {
    if (hasInitialized.current) return;
    if (isStreaming) return;
    if (!websiteId || !projectId) return;

    hasInitialized.current = true;
    updateState({
      command: "create",
      websiteId,
      projectId,
    });
  });

  useEffect(() => {
    maybeInit();
  }, [websiteId, projectId]);
}

/**
 * Website Build step - generates the website content
 */
export default function BuildStep() {
  const { project } = usePage<WebsitePageProps>().props;
  const chat = useWebsiteChat();
  const isLoadingHistory = useWebsiteChatIsLoadingHistory();
  const isStreaming = useWebsiteChatIsStreaming();

  // Auto-init website generation on first load
  useWebsiteInit();

  // Show loading when:
  // 1. Loading chat history from server
  // 2. Sending message
  const isLoading = isLoadingHistory || isStreaming;

  // Navigate to domain step
  const handleContinue = useCallback(() => {
    if (project?.uuid) {
      router.visit(`/projects/${project.uuid}/website/domain`);
    }
  }, [project?.uuid]);

  // Credit integration is automatic via ChatProvider - no manual wiring needed
  return (
    <Chat.Root chat={chat}>
      <div className="h-full flex flex-col">
        {/* Main content area - no bottom padding so preview extends behind footer */}
        <main className="flex-1 min-h-0 grid grid-cols-[1fr_3fr] gap-x-[3%] px-[2.5%] pt-[2.5%]">
          {/* Left sidebar */}
          <div>
            <WebsiteSidebar isLoading={isLoading} currentStep={0} />
          </div>

          {/* Preview content - negative margin extends behind footer, overflow clips rounded corners */}
          <div className="min-h-0 -mb-20 overflow-hidden">
            {isLoading ? (
              <div className="border-[#D3D2D0] border rounded-2xl bg-white flex items-center justify-center h-full">
                <WebsiteLoader steps={websiteLoaderSteps} currentStep={0} />
              </div>
            ) : (
              <WebsitePreview />
            )}
          </div>
        </main>

        {/* Footer - full width background, content aligned with preview */}
        <PaginationFooter.Root layout="full-bleed" isPending={isLoading} canGoBack={false}>
          <PaginationFooter.BackButton />
          <PaginationFooter.Actions>
            <PaginationFooter.ActionButton disabled={isLoading}>
              Preview
            </PaginationFooter.ActionButton>
            <PaginationFooter.ActionButton onClick={handleContinue}>
              Continue
            </PaginationFooter.ActionButton>
          </PaginationFooter.Actions>
        </PaginationFooter.Root>
      </div>
    </Chat.Root>
  );
}
