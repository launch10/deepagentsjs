import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useStore, type StoreApi } from "zustand";
import { usePage } from "@inertiajs/react";
import {
  createBrandPersonalizationStore,
  type BrandPersonalizationState,
  type BrandLogo,
  type ProjectImage,
} from "@stores/brandPersonalization";
import { UploadService, type CreateUploadResponse } from "@api/uploads";
import { ThemeService, type GetThemesResponse, type CreateThemeResponse } from "@api/themes";

type BrandPersonalizationStoreApi = StoreApi<BrandPersonalizationState>;

interface BrandPersonalizationContextType {
  store: BrandPersonalizationStoreApi;
  uploadLogo: (file: File) => Promise<BrandLogo>;
  uploadProjectImage: (file: File, tempId: string) => Promise<ProjectImage>;
  deleteLogo: (uploadId: number) => Promise<void>;
  deleteProjectImage: (uploadId: number) => Promise<void>;
  fetchThemes: () => Promise<GetThemesResponse>;
  createTheme: (name: string, colors: string[]) => Promise<CreateThemeResponse>;
}

const BrandPersonalizationContext = createContext<BrandPersonalizationContextType | null>(null);

interface BrandPersonalizationProviderProps {
  children: ReactNode;
}

/**
 * Provider for brand personalization state.
 * Provides upload functions and theme fetching pre-configured with JWT.
 */
export function BrandPersonalizationProvider({ children }: BrandPersonalizationProviderProps) {
  const { jwt, website } = usePage<{ jwt: string; website?: { id: number } }>().props;

  // Create store once (stable reference)
  const [store] = useState(() => createBrandPersonalizationStore());

  // Upload logo function
  const uploadLogo = useCallback(
    async (file: File): Promise<BrandLogo> => {
      const uploadService = new UploadService({ jwt });
      const response: CreateUploadResponse = await uploadService.create({
        "upload[file]": file,
        "upload[is_logo]": true,
        "upload[website_id]": website?.id,
      });

      return {
        uploadId: response.id,
        url: response.url,
        thumbUrl: response.thumb_url ?? undefined,
      };
    },
    [jwt, website?.id]
  );

  // Upload project image function
  const uploadProjectImage = useCallback(
    async (file: File, _tempId: string): Promise<ProjectImage> => {
      const uploadService = new UploadService({ jwt });
      const response: CreateUploadResponse = await uploadService.create({
        "upload[file]": file,
        "upload[is_logo]": false,
        "upload[website_id]": website?.id,
      });

      return {
        uploadId: response.id,
        url: response.url,
        thumbUrl: response.thumb_url ?? undefined,
      };
    },
    [jwt, website?.id]
  );

  // Delete logo function
  const deleteLogo = useCallback(
    async (uploadId: number): Promise<void> => {
      const uploadService = new UploadService({ jwt });
      await uploadService.delete(uploadId);
    },
    [jwt]
  );

  // Delete project image function
  const deleteProjectImage = useCallback(
    async (uploadId: number): Promise<void> => {
      const uploadService = new UploadService({ jwt });
      await uploadService.delete(uploadId);
    },
    [jwt]
  );

  // Fetch themes function
  const fetchThemes = useCallback(async (): Promise<GetThemesResponse> => {
    const themeService = new ThemeService({ jwt });
    return themeService.get();
  }, [jwt]);

  // Create theme function
  const createTheme = useCallback(
    async (name: string, colors: string[]): Promise<CreateThemeResponse> => {
      const themeService = new ThemeService({ jwt });
      return themeService.create({
        theme: {
          name,
          colors,
        },
      });
    },
    [jwt]
  );

  return (
    <BrandPersonalizationContext.Provider
      value={{ store, uploadLogo, uploadProjectImage, deleteLogo, deleteProjectImage, fetchThemes, createTheme }}
    >
      {children}
    </BrandPersonalizationContext.Provider>
  );
}

/**
 * Hook to access brand personalization state with selectors.
 */
export function useBrandPersonalizationStore<T>(
  selector: (state: BrandPersonalizationState) => T
): T {
  const context = useContext(BrandPersonalizationContext);
  if (!context) {
    throw new Error(
      "useBrandPersonalizationStore must be used within BrandPersonalizationProvider"
    );
  }
  return useStore(context.store, selector);
}

/**
 * Hook to access brand personalization actions (upload, fetch themes, etc.)
 */
export function useBrandPersonalizationActions() {
  const context = useContext(BrandPersonalizationContext);
  if (!context) {
    throw new Error(
      "useBrandPersonalizationActions must be used within BrandPersonalizationProvider"
    );
  }

  const { uploadLogo, uploadProjectImage, deleteLogo, deleteProjectImage, fetchThemes, createTheme } = context;
  return { uploadLogo, uploadProjectImage, deleteLogo, deleteProjectImage, fetchThemes, createTheme };
}

/**
 * Convenience hook that returns all state and actions.
 */
export function useBrandPersonalization() {
  const context = useContext(BrandPersonalizationContext);
  if (!context) {
    throw new Error("useBrandPersonalization must be used within BrandPersonalizationProvider");
  }

  const state = useStore(context.store);
  const { uploadLogo, uploadProjectImage, deleteLogo, deleteProjectImage, fetchThemes, createTheme } = context;

  return {
    ...state,
    uploadLogo,
    uploadProjectImage,
    deleteLogo,
    deleteProjectImage,
    fetchThemes,
    createTheme,
  };
}

// Selectors for fine-grained subscriptions
export const selectLogo = (s: BrandPersonalizationState) => s.logo;
export const selectSelectedThemeId = (s: BrandPersonalizationState) => s.selectedThemeId;
export const selectSocialLinks = (s: BrandPersonalizationState) => s.socialLinks;
export const selectProjectImages = (s: BrandPersonalizationState) => s.projectImages;
export const selectError = (s: BrandPersonalizationState) => s.error;
export const selectIsUploadingLogo = (s: BrandPersonalizationState) => s.isUploadingLogo;
export const selectUploadingImageIds = (s: BrandPersonalizationState) => s.uploadingImageIds;

/**
 * Selector to check if any brand personalizations have been applied.
 * Returns true if logo, theme, social links, or project images have been set.
 */
export const selectHasAnyPersonalizations = (s: BrandPersonalizationState): boolean => {
  const hasSocialLinks = Boolean(
    s.socialLinks.twitter || s.socialLinks.instagram || s.socialLinks.youtube
  );
  return Boolean(
    s.logo ||
    s.selectedThemeId !== null ||
    hasSocialLinks ||
    s.projectImages.length > 0
  );
};
