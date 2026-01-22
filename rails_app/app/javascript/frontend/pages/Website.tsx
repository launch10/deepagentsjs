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
  useWebsiteChatIsStreaming,
} from "@hooks/website";
import { useSyncPageProps } from "~/stores/useSyncCoreEntities";
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
        "shrink-0 relative z-10",
        "bg-background",
        isLoading && "opacity-50 pointer-events-none"
      )}
    >
      {/* Border line - fades on left, extends to right edge of screen */}
      <div className="grid grid-cols-[1fr_3fr] gap-x-[3%] px-[2.5%]">
        <div />
        <div
          className="h-px bg-neutral-200 -ml-8 -mr-[2.5vw] shadow-[0px_-16px_26px_0px_rgba(15,17,19,0.06)]"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 32px)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 32px)",
          }}
        />
      </div>

      {/* Button content */}
      <div className="grid grid-cols-[1fr_3fr] gap-x-[3%] px-[2.5%] py-4">
        <div />
        <div className="flex items-center justify-between pr-[2.5%]">
          <Button variant="link" disabled>
            Previous Step
          </Button>
          <div className="flex gap-3">
            <Button disabled>Preview</Button>
            <Button disabled>Continue</Button>
          </div>
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
  useSyncPageProps(usePage().props);

  const chat = useWebsiteChat();
  const isLoadingHistory = useWebsiteChatIsLoadingHistory();
  const isStreaming = useWebsiteChatIsStreaming();

  // Auto-init website generation on first load
  useWebsiteInit();

  // Show loading when:
  // 1. Loading chat history from server
  // 2. Sending message
  const isLoading = isLoadingHistory || isStreaming;

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
        <WebsitePaginationFooter isLoading={isLoading} />
      </div>
    </Chat.Root>
  );
}
