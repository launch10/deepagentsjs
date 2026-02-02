import WebsiteLoader from "@components/website/WebsiteLoader";
import WebsiteSidebar from "@components/website/sidebar/WebsiteSidebar";
import { WebsitePreview } from "@components/website/preview";
import { DomainPicker } from "@components/website/domain-picker";
import { ClaimSubdomainModal } from "@components/website/domain-picker/ClaimSubdomainModal";
import { Chat } from "@components/shared/chat/Chat";
import { Button } from "@components/ui/button";
import { twMerge } from "tailwind-merge";
import { useEffect, useEffectEvent, useRef, useCallback, useState } from "react";
import { usePage, router } from "@inertiajs/react";
import {
  useWebsiteChat,
  useWebsiteChatState,
  useWebsiteChatIsLoadingHistory,
  useWebsiteChatActions,
  useWebsiteChatIsStreaming,
} from "@hooks/website";
import { useDomainContext, useCreateDomain } from "~/api/domainContext.hooks";
import type { Workflow } from "@shared";
import type { DomainSelection } from "@components/website/domain-picker";

interface WebsitePageProps {
  website?: { id?: number };
  project?: { id?: number; uuid?: string };
  substep?: Workflow.WebsiteSubstepName;
  thread_id?: string;
  jwt?: string;
  langgraph_path?: string;
  [key: string]: unknown;
}


const websiteLoaderSteps = [{ id: "1", label: "Setting up branding & colors" }];

/**
 * Website-specific pagination footer with disabled/muted styling.
 * Shows "Previous Step", "Preview", and "Continue" buttons in a faded state
 * while the website is being generated.
 *
 * Note: This is a standalone component that doesn't use the shared
 * PaginationFooterView because that component has Ads-specific hooks.
 */
function WebsitePaginationFooter({
  isLoading,
  onContinue,
}: {
  isLoading: boolean;
  onContinue?: () => void;
}) {
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
            <Button disabled={isLoading}>Preview</Button>
            <Button disabled={isLoading} onClick={onContinue}>
              Continue
            </Button>
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
  // Read directly from page props - simple and stable
  const { website, project } = usePage<WebsitePageProps>().props;
  const websiteId = website?.id;
  const projectId = project?.id;

  const { updateState } = useWebsiteChatActions();
  const isStreaming = useWebsiteChatIsStreaming();
  const chatId = useWebsiteChatState("chatId");
  const hasInitialized = useRef(!!chatId);

  const maybeInit = useEffectEvent(() => {
    // Only initialize once, and only if status is pending (no generation started)
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
 * Website Build step - generates the website content
 */
function WebsiteBuild() {
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
        <WebsitePaginationFooter isLoading={isLoading} onContinue={handleContinue} />
      </div>
    </Chat.Root>
  );
}

/**
 * Website Domain step - pick domain and path for deployment
 * Uses the same layout as WebsiteBuild with sidebar + main content
 */
function WebsiteDomainStep() {
  const { project, website, thread_id } = usePage<WebsitePageProps>().props;
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
        {/* Main content area - same grid layout as WebsiteBuild */}
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
              onBack={handleBack}
            />
          </div>
        </main>

        {/* Footer - same style as WebsiteBuild */}
        <div className="shrink-0 relative z-10 bg-background">
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
              <Button variant="link" onClick={handleBack}>
                Previous Step
              </Button>
              <div className="flex gap-3">
                <Button onClick={handleConnectSiteClick} disabled={!selection}>
                  Connect Site
                </Button>
              </div>
            </div>
          </div>
        </div>
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

/**
 * Website Deploy step - deploy the website
 */
function WebsiteDeployStep() {
  // TODO: Implement deploy UI component
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <h1 className="text-2xl font-semibold mb-4">Deploy Website</h1>
      <p className="text-gray-500">Deploy UI coming soon...</p>
    </div>
  );
}

export default function Website() {
  const { substep = "build" } = usePage<WebsitePageProps>().props;

  // Render the appropriate substep view
  switch (substep) {
    case "build":
      return <WebsiteBuild />;
    case "domain":
      return <WebsiteDomainStep />;
    case "deploy":
      return <WebsiteDeployStep />;
    default:
      return <WebsiteBuild />;
  }
}
