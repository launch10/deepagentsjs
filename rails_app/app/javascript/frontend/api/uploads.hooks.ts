import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import {
  UploadsAPIService,
  type GetUploadsResponse,
  type CreateUploadResponse,
} from "@rails_api_base";
import { useWebsite } from "./websites.hooks";
import { useBrainstormChatWebsiteId } from "@hooks/useBrainstormChat";

// Re-export for backwards compatibility
export { UploadsAPIService as UploadService } from "@rails_api_base";

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
  const { jwt, root_path } = usePage<{ jwt: string; root_path: string }>().props;
  return useMemo(() => new UploadsAPIService({ jwt, baseUrl: root_path }), [jwt, root_path]);
}

/**
 * Hook to get website ID - uses chat state (primary) with page props fallback.
 */
function useWebsiteId(): number | null {
  const chatWebsiteId = useBrainstormChatWebsiteId();
  const { data: website } = useWebsite();
  const propsWebsiteId = website?.id ?? null;

  const result = chatWebsiteId ?? propsWebsiteId;
  console.log("[useWebsiteId]", { chatWebsiteId, propsWebsiteId, result });
  return result;
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

// ============================================================================
// Mutation Hooks
// ============================================================================

type MutationOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, Error, TVariables>,
  "mutationFn"
>;

/** Result type for upload mutations */
export interface UploadResult {
  uploadId: number;
  url: string;
  thumbUrl?: string;
}

interface UploadLogoVariables {
  file: File;
  websiteId?: number;
}

/**
 * Hook for uploading a logo.
 * Automatically invalidates the uploads cache on success.
 */
export function useUploadLogo(options?: MutationOptions<UploadResult, UploadLogoVariables>) {
  const service = useUploadService();
  const websiteId = useWebsiteId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, websiteId: explicitWebsiteId }: UploadLogoVariables) => {
      const currentWebsiteId = explicitWebsiteId ?? websiteId ?? undefined;
      console.log("[useUploadLogo] mutationFn called", {
        explicitWebsiteId,
        websiteId,
        currentWebsiteId,
      });
      const response = await service.create({
        file,
        isLogo: true,
        websiteId: currentWebsiteId,
      });
      return {
        uploadId: response.id,
        url: response.url,
        thumbUrl: response.thumb_url ?? undefined,
      };
    },
    onSuccess: () => {
      console.log("[useUploadLogo] onSuccess", { websiteId });
      if (websiteId) {
        queryClient.invalidateQueries({ queryKey: uploadsKeys.websiteUploads(websiteId) });
      }
    },
    ...options,
  });
}

interface UploadProjectImageVariables {
  file: File;
  websiteId?: number;
}

/**
 * Hook for uploading a project image (non-logo).
 * Automatically invalidates the uploads cache on success.
 */
export function useUploadProjectImage(
  options?: MutationOptions<UploadResult, UploadProjectImageVariables>
) {
  const service = useUploadService();
  const websiteId = useWebsiteId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, websiteId: explicitWebsiteId }: UploadProjectImageVariables) => {
      const currentWebsiteId = explicitWebsiteId ?? websiteId ?? undefined;
      console.log("[useUploadProjectImage] mutationFn called", {
        explicitWebsiteId,
        websiteId,
        currentWebsiteId,
      });
      const response = await service.create({
        file,
        isLogo: false,
        websiteId: currentWebsiteId,
      });
      return {
        uploadId: response.id,
        url: response.url,
        thumbUrl: response.thumb_url ?? undefined,
      };
    },
    onSuccess: () => {
      console.log("[useUploadProjectImage] onSuccess", { websiteId });
      if (websiteId) {
        queryClient.invalidateQueries({ queryKey: uploadsKeys.websiteUploads(websiteId) });
      }
    },
    ...options,
  });
}

interface DeleteUploadVariables {
  uploadId: number;
}

/**
 * Hook for deleting an upload (logo or image).
 * Automatically removes from cache on success.
 */
export function useDeleteUpload(options?: MutationOptions<void, DeleteUploadVariables>) {
  const service = useUploadService();
  const websiteId = useWebsiteId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ uploadId }: DeleteUploadVariables) => {
      await service.delete(uploadId);
    },
    onSuccess: (_, { uploadId }) => {
      if (websiteId) {
        queryClient.setQueryData<GetUploadsResponse>(
          uploadsKeys.websiteUploads(websiteId),
          (oldData) => oldData?.filter((upload) => upload.id !== uploadId) ?? []
        );
      }
    },
    ...options,
  });
}
