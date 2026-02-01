import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDomainsService } from "~/api/domainContext.hooks";
import type { VerifyDnsResponse } from "@shared";

interface UseDnsVerificationOptions {
  /** Whether the hook should poll for DNS verification status */
  enabled?: boolean;
  /** Polling interval in milliseconds (default: 30000 = 30 seconds) */
  pollInterval?: number;
}

/**
 * Hook for DNS verification with auto-polling
 *
 * Automatically polls for DNS verification status until the domain is verified.
 * Once verified, polling stops. Provides a manual check function for immediate verification.
 *
 * @param domainId - The ID of the domain to verify
 * @param options - Configuration options
 * @returns DNS verification state and controls
 */
export function useDnsVerification(
  domainId: number | null,
  options: UseDnsVerificationOptions = {}
) {
  const { enabled = true, pollInterval = 30000 } = options;
  const domainsService = useDomainsService();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["dns-verification", domainId],
    queryFn: async () => {
      if (!domainId) {
        throw new Error("Domain ID is required");
      }
      return domainsService.verifyDns(domainId);
    },
    enabled: enabled && domainId !== null,
    refetchInterval: (query) => {
      // Stop polling once verified
      if (query.state.data?.verification_status === "verified") {
        return false;
      }
      return pollInterval;
    },
    staleTime: 10000,
  });

  /**
   * Trigger an immediate DNS verification check
   */
  const manualCheck = async () => {
    if (!domainId) return null;
    return queryClient.invalidateQueries({ queryKey: ["dns-verification", domainId] });
  };

  return {
    /** The DNS verification data */
    data: query.data,
    /** Whether the initial query is loading */
    isLoading: query.isLoading,
    /** Whether the domain DNS is verified */
    isVerified: query.data?.verification_status === "verified",
    /** Whether verification is pending */
    isPending: query.data?.verification_status === "pending",
    /** Whether verification has failed */
    isFailed: query.data?.verification_status === "failed",
    /** Error message if verification failed */
    error: query.data?.error_message ?? null,
    /** The expected CNAME value */
    expectedCname: query.data?.expected_cname ?? null,
    /** The actual CNAME found */
    actualCname: query.data?.actual_cname ?? null,
    /** When DNS was last checked */
    lastCheckedAt: query.data?.last_checked_at ?? null,
    /** Trigger an immediate DNS check */
    manualCheck,
  };
}
