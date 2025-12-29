import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useStore, type StoreApi } from "zustand";
import { usePage } from "@inertiajs/react";
import {
  createBrandPersonalizationStore,
  type BrandPersonalizationState,
  type BrandLogo,
  type ProductImage,
} from "@stores/brandPersonalization";
import { UploadService, type CreateUploadResponse } from "@api/uploads";
import { ThemeService, type GetThemesResponse, type CreateThemeResponse } from "@api/themes";

type BrandPersonalizationStoreApi = StoreApi<BrandPersonalizationState>;

interface BrandPersonalizationContextType {
  store: BrandPersonalizationStoreApi;
  uploadLogo: (file: File) => Promise<BrandLogo>;
  uploadProductImage: (file: File, tempId: string) => Promise<ProductImage>;
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
  const { jwt } = usePage<{ jwt: string }>().props;

  // Create store once (stable reference)
  const [store] = useState(() => createBrandPersonalizationStore());

  // Upload logo function
  const uploadLogo = useCallback(
    async (file: File): Promise<BrandLogo> => {
      const uploadService = new UploadService({ jwt });
      const response: CreateUploadResponse = await uploadService.create({
        "upload[file]": file,
        "upload[is_logo]": true,
      });

      return {
        uploadId: response.id,
        url: response.url,
        thumbUrl: response.thumb_url ?? undefined,
      };
    },
    [jwt]
  );

  // Upload product image function
  const uploadProductImage = useCallback(
    async (file: File, _tempId: string): Promise<ProductImage> => {
      const uploadService = new UploadService({ jwt });
      const response: CreateUploadResponse = await uploadService.create({
        "upload[file]": file,
        "upload[is_logo]": false,
      });

      return {
        uploadId: response.id,
        url: response.url,
        thumbUrl: response.thumb_url ?? undefined,
      };
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
      value={{ store, uploadLogo, uploadProductImage, fetchThemes, createTheme }}
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

  const { uploadLogo, uploadProductImage, fetchThemes, createTheme } = context;
  return { uploadLogo, uploadProductImage, fetchThemes, createTheme };
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
  const { uploadLogo, uploadProductImage, fetchThemes, createTheme } = context;

  return {
    ...state,
    uploadLogo,
    uploadProductImage,
    fetchThemes,
    createTheme,
  };
}

// Selectors for fine-grained subscriptions
export const selectLogo = (s: BrandPersonalizationState) => s.logo;
export const selectSelectedThemeId = (s: BrandPersonalizationState) => s.selectedThemeId;
export const selectSocialLinks = (s: BrandPersonalizationState) => s.socialLinks;
export const selectProductImages = (s: BrandPersonalizationState) => s.productImages;
export const selectError = (s: BrandPersonalizationState) => s.error;
export const selectIsUploadingLogo = (s: BrandPersonalizationState) => s.isUploadingLogo;
export const selectUploadingImageIds = (s: BrandPersonalizationState) => s.uploadingImageIds;
