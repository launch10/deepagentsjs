import WebsiteSidebar from "@components/website/sidebar/WebsiteSidebar";
import { DomainPicker } from "@components/website/domain-picker";
import { Chat } from "@components/shared/chat/Chat";
import { PaginationFooter } from "@components/shared/pagination-footer";
import { useEffect, useEffectEvent, useRef, useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import {
  useWebsiteChat,
  useWebsiteChatState,
  useWebsiteChatActions,
  useWebsiteChatIsStreaming,
} from "@hooks/website";
import { useCreateDomain } from "~/api/domainContext.hooks";
import { isPlatformDomain } from "~/lib/domain";
import type { WebsiteUrl } from "@components/website/domain-picker";

interface WebsitePageProps {
  website?: { id?: number };
  project?: { id?: number; uuid?: string };
  [key: string]: unknown;
}

/**
 * Auto-initialize the website graph if it hasn't run yet.
 * Used on the Domain page to ensure domainRecommendations are populated.
 *
 * This handles the case where user navigates directly to /website/domain
 * without going through /website/build first. The graph needs to run to
 * populate domainRecommendations.
 *
 * Detection logic:
 * - If domainRecommendations is undefined AND we're not streaming AND files don't exist
 * - Then the graph hasn't run, so trigger it
 */
function useDomainPageInit() {
  const { website, project } = usePage<WebsitePageProps>().props;
  const websiteId = website?.id;
  const projectId = project?.id;

  const { updateState } = useWebsiteChatActions();
  const isStreaming = useWebsiteChatIsStreaming();
  const domainRecommendations = useWebsiteChatState("domainRecommendations");
  const files = useWebsiteChatState("files");
  const status = useWebsiteChatState("status");

  const hasInitialized = useRef(false);

  const maybeInit = useEffectEvent(() => {
    if (hasInitialized.current) return;
    if (isStreaming) return;
    if (!websiteId || !projectId) return;

    // Check if graph has already run
    const hasFiles = files && Object.keys(files).length > 0;
    const hasRecommendations = !!domainRecommendations;
    const graphHasRun = hasRecommendations || hasFiles || (status && status !== "pending");

    if (graphHasRun) {
      hasInitialized.current = true;
      return;
    }

    // Graph hasn't run - kick it off
    hasInitialized.current = true;
    updateState({
      command: "create",
      websiteId,
      projectId,
    });
  });

  useEffect(() => {
    maybeInit();
  }, [websiteId, projectId, domainRecommendations, files, status, isStreaming]);

  return { isInitializing: isStreaming && !domainRecommendations };
}

/**
 * Website Domain step - pick domain and path for deployment
 * Uses the same layout as BuildStep with sidebar + main content
 */
export default function DomainStep() {
  const { project, website } = usePage<WebsitePageProps>().props;
  const chat = useWebsiteChat();
  const [selection, setSelection] = useState<WebsiteUrl | null>(null);

  // Auto-init the website graph if it hasn't run yet
  // This ensures domainRecommendations are populated even if user navigates directly here
  useDomainPageInit();

  // Domain creation mutation
  const createDomain = useCreateDomain();

  const handleSelectionChange = useCallback((newSelection: WebsiteUrl | null) => {
    setSelection(newSelection);
  }, []);

  // Save domain before continuing to next step
  const beforeContinue = useCallback(async () => {
    if (!selection || !website?.id) {
      return "Please select a domain first";
    }

    try {
      await createDomain.mutateAsync({
        domain: selection.domain,
        websiteId: website.id,
        path: selection.path,
        isPlatformSubdomain: isPlatformDomain(selection.domain),
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect domain";
      return message;
    }
  }, [selection, website?.id, createDomain]);

  return (
    <Chat.Root chat={chat}>
      <div className="h-full flex flex-col">
        {/* Main content area - same grid layout as BuildStep */}
        <main className="flex-1 min-h-0 grid grid-cols-[1fr_3fr] gap-x-[3%] px-[2.5%] pt-[2.5%]">
          {/* Left sidebar with workflow steps + locked chat */}
          <div>
            <WebsiteSidebar substep="domain" chatLocked />
          </div>

          {/* Main content - domain picker form */}
          <div className="min-h-0 -mb-20 overflow-hidden">
            <DomainPicker
              selection={selection}
              onSelectionChange={handleSelectionChange}
            />
          </div>
        </main>

        {/* Footer - same style as BuildStep */}
        <PaginationFooter.Root
          layout="full-bleed"
          isPending={createDomain.isPending}
          canGoBack={true}
        >
          <PaginationFooter.BackButton />
          <PaginationFooter.Actions>
            <PaginationFooter.ContinueButton
              beforeContinue={beforeContinue}
              disabled={!selection}
              loading={createDomain.isPending}
            >
              Connect Site
            </PaginationFooter.ContinueButton>
          </PaginationFooter.Actions>
        </PaginationFooter.Root>
      </div>
    </Chat.Root>
  );
}
