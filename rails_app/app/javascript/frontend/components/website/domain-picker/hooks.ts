import { useState, useEffect, useCallback } from "react";
import { useDomainContext, useDomainAssignment } from "~/api/domainContext.hooks";
import { useWebsiteChatState } from "~/hooks/website/useWebsiteChat";
import { isPlatformDomain } from "~/lib/domain";
import type { Website } from "@shared";
import type { WebsiteUrl } from "./DomainPicker";

// ============================================================================
// useDomainPickerData - All data fetching & derived values
// ============================================================================

export function useDomainPickerData(websiteId: number | undefined) {
  // Fetch domain context from Rails (existing domains, credits, assigned URL)
  const { data: context, isLoading, error } = useDomainContext(websiteId);

  // Get AI recommendations from website graph state
  const recommendations = useWebsiteChatState("domainRecommendations") as
    | Website.DomainRecommendations.DomainRecommendations
    | undefined;

  // Derived values
  const assignedUrl = context?.assigned_url ?? null;
  const isOutOfCredits = context?.platform_subdomain_credits?.remaining === 0;
  const creditsRemaining = context?.platform_subdomain_credits?.remaining ?? 0;

  return {
    context,
    recommendations,
    isLoading,
    error,
    assignedUrl,
    isOutOfCredits,
    creditsRemaining,
  };
}

// ============================================================================
// useClaimSubdomain - Claim modal flow for new platform subdomains
// ============================================================================

/** Check if a selection requires claiming a new platform subdomain */
const needsClaimModal = (sel: WebsiteUrl): boolean =>
  !sel.existingDomainId && isPlatformDomain(sel.domain);

interface UseClaimSubdomainOptions {
  websiteId: number | undefined;
  onClaimed: (selection: WebsiteUrl) => void;
  markPersisted: (selection: WebsiteUrl) => void;
}

export function useClaimSubdomain({
  websiteId,
  onClaimed,
  markPersisted,
}: UseClaimSubdomainOptions) {
  const [showModal, setShowModal] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<WebsiteUrl | null>(null);

  // Domain assignment mutation for claiming
  const domainAssignment = useDomainAssignment(websiteId, 750);

  /**
   * Check if selection needs claim modal. If yes, opens modal and returns true.
   * If no, returns false and caller should proceed normally.
   */
  const maybeClaim = useCallback((selection: WebsiteUrl): boolean => {
    if (needsClaimModal(selection)) {
      setPendingClaim(selection);
      setShowModal(true);
      return true;
    }
    return false;
  }, []);

  /** Confirm the claim - saves immediately and notifies parent */
  const confirm = useCallback(async () => {
    if (!pendingClaim || !websiteId) return;

    try {
      const result = await domainAssignment.mutateNowAsync({
        domain: pendingClaim.domain,
        websiteId,
        path: pendingClaim.path,
        isPlatformSubdomain: true,
      });

      const claimedSelection: WebsiteUrl = {
        ...pendingClaim,
        origin: "existing",
        existingDomainId: result.domain.id,
      };

      onClaimed(claimedSelection);
      markPersisted(claimedSelection);
      setShowModal(false);
      setPendingClaim(null);
    } catch (error) {
      console.error("Failed to claim subdomain:", error);
    }
  }, [pendingClaim, websiteId, domainAssignment, onClaimed, markPersisted]);

  /** Close modal without claiming */
  const close = useCallback(() => {
    setShowModal(false);
    setPendingClaim(null);
  }, []);

  return {
    showModal,
    pendingClaim,
    maybeClaim,
    confirm,
    close,
    isPending: domainAssignment.isPending,
  };
}

// ============================================================================
// useSelectionInit - Initialize selection from assigned URL or recommendations
// ============================================================================

interface UseSelectionInitOptions {
  isLoading: boolean;
  assignedUrl: { domain: string; path?: string | null; domain_id: number } | null;
  topRecommendation: Website.DomainRecommendations.DomainRecommendation | null | undefined;
  onSelectionChange: (selection: WebsiteUrl | null) => void;
  markPersisted: (selection: WebsiteUrl) => void;
}

export function useSelectionInit({
  isLoading,
  assignedUrl,
  topRecommendation,
  onSelectionChange,
  markPersisted,
}: UseSelectionInitOptions) {
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (hasInitialized || isLoading) return;

    // Priority 1: Use assigned URL from website
    if (assignedUrl) {
      const initial: WebsiteUrl = {
        domain: assignedUrl.domain,
        path: assignedUrl.path ?? "/",
        origin: "existing",
        existingDomainId: assignedUrl.domain_id,
      };
      onSelectionChange(initial);
      markPersisted(initial);
      setHasInitialized(true);
      return;
    }

    // Priority 2: Use AI top recommendation
    if (topRecommendation) {
      onSelectionChange({
        domain: topRecommendation.domain,
        path: topRecommendation.path,
        origin: topRecommendation.source,
        existingDomainId: topRecommendation.existingDomainId,
      });
      setHasInitialized(true);
    }
  }, [hasInitialized, isLoading, assignedUrl, topRecommendation, onSelectionChange, markPersisted]);

  return { hasInitialized };
}
