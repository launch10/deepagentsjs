import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { UploadService, type GetUploadsResponse } from "./uploads";
import { useWebsite } from "./websites.hooks";

// ============================================================================
// Query Keys
// ============================================================================

export const uploadsKeys = {
  all: ["uploads"] as const,
  lists: () => [...uploadsKeys.all, "list"] as const,
  websiteUploads: (websiteId: number) =>
    [...uploadsKeys.lists(), { website_id: websiteId }] as const,
};

// ============================================================================
// Service Hook
// ============================================================================

export function useUploadService() {
  const { jwt } = usePage<{ jwt: string }>().props;
  return useMemo(() => new UploadService({ jwt }), [jwt]);
}

function useWebsiteId(): number | null {
  const { data: website } = useWebsite();
  return website?.id ?? null;
}

// ============================================================================
// Query Hooks
// ============================================================================

type UploadsQueryOptions = Omit<UseQueryOptions<GetUploadsResponse, Error>, "queryKey" | "queryFn">;

/**
 * Hook for fetching all uploads for a website.
 * This is the base query that other hooks filter from.
 */
export function useWebsiteUploads(options?: UploadsQueryOptions) {
  const service = useUploadService();
  const websiteId = useWebsiteId();

  return useQuery({
    queryKey: uploadsKeys.websiteUploads(websiteId ?? 0),
    queryFn: () => service.get({ website_id: websiteId! }),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

/**
 * Hook for fetching the project logo.
 * Filters from useWebsiteUploads to avoid duplicate API calls.
 */
export function useProjectLogo(options?: UploadsQueryOptions) {
  const query = useWebsiteUploads(options);

  const logo = useMemo(() => {
    if (!query.data) return undefined;
    const logos = query.data.filter((upload) => upload.is_logo);
    return logos.length > 0 ? logos : undefined;
  }, [query.data]);

  return {
    ...query,
    data: logo,
  };
}

/**
 * Hook for fetching project images (non-logo uploads).
 * Filters from useWebsiteUploads to avoid duplicate API calls.
 */
export function useProjectImages(options?: UploadsQueryOptions) {
  const query = useWebsiteUploads(options);

  const productImages = useMemo(() => {
    if (!query.data) return undefined;
    const images = query.data.filter((upload) => !upload.is_logo);
    return images.length > 0 ? images : undefined;
  }, [query.data]);

  return {
    ...query,
    data: productImages,
  };
}
