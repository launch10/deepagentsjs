import WebsiteSidebar from "@components/website/sidebar/WebsiteSidebar";
import { DomainPicker } from "@components/website/domain-picker";
import { ClaimSubdomainModal } from "@components/website/domain-picker/ClaimSubdomainModal";
import { Chat } from "@components/shared/chat/Chat";
import { PaginationFooter } from "@components/shared/pagination-footer";
import { useEffect, useEffectEvent, useRef, useCallback, useState } from "react";
import { usePage, router } from "@inertiajs/react";
import {
  useWebsiteChat,
  useWebsiteChatState,
  useWebsiteChatActions,
  useWebsiteChatIsStreaming,
} from "@hooks/website";
import { useDomainContext, useCreateDomain } from "~/api/domainContext.hooks";
import type { DomainSelection } from "@components/website/domain-picker";

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
  const [selection, setSelection] = useState<DomainSelection | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Auto-init the website graph if it hasn't run yet
  // This ensures domainRecommendations are populated even if user navigates directly here
  useDomainPageInit();

  // Fetch domain context for credits info
  const { data: domainContext } = useDomainContext(website?.id);
  const creditsRemaining = domainContext?.platform_subdomain_credits?.remaining ?? 0;

  // Domain creation mutation
  const createDomain = useCreateDomain({
    onSuccess: () => {
      // Navigate to deploy step after successful domain creation
      if (project?.uuid) {
        router.visit(`/projects/${project.uuid}/website/deploy`);
      }
    },
    onError: (error) => {
      console.error("Failed to create domain:", error);
      setShowConfirmModal(false);
    },
  });

  const handleSelectionChange = useCallback((newSelection: DomainSelection | null) => {
    setSelection(newSelection);
  }, []);

  // Handle confirmation of subdomain claim
  const handleConfirmClaim = useCallback(() => {
    if (!selection || !website?.id) {
      console.warn("Missing selection or website ID");
      return;
    }

    createDomain.mutate({
      domain: selection.domain,
      websiteId: website.id,
      path: selection.path,
      isPlatformSubdomain: selection.domain.endsWith(".launch10.site"),
    });
  }, [selection, website?.id, createDomain]);

  // Handle Connect Site button click - show confirmation modal for platform subdomains
  const handleConnectSiteClick = useCallback(() => {
    if (!selection) {
      console.warn("No domain selection to save");
      return;
    }

    // Check if this is a platform subdomain (launch10.site)
    const isPlatformSubdomain = selection.domain.endsWith(".launch10.site");

    if (isPlatformSubdomain && selection.isNew) {
      // Show confirmation modal for new platform subdomains
      setShowConfirmModal(true);
    } else {
      // For existing domains or custom domains, proceed directly
      handleConfirmClaim();
    }
  }, [selection, handleConfirmClaim]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (project?.uuid) {
      router.visit(`/projects/${project.uuid}/website/build`);
    }
  }, [project?.uuid]);

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
          <PaginationFooter.BackButton onClick={handleBack} />
          <PaginationFooter.Actions>
            <PaginationFooter.ActionButton
              onClick={handleConnectSiteClick}
              disabled={!selection}
            >
              Connect Site
            </PaginationFooter.ActionButton>
          </PaginationFooter.Actions>
        </PaginationFooter.Root>
      </div>

      {/* Confirmation modal for claiming platform subdomain */}
      {selection && (
        <ClaimSubdomainModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmClaim}
          domain={selection.fullUrl}
          creditsRemaining={creditsRemaining}
          isLoading={createDomain.isPending}
        />
      )}
    </Chat.Root>
  );
}
