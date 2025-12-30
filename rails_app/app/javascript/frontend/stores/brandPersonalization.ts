import { create } from "zustand";
import { useStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { UploadService, type CreateUploadResponse } from "@api/uploads";
import { ThemeService, type GetThemesResponse, type CreateThemeResponse } from "@api/themes";

export interface BrandLogo {
  uploadId: number;
  url: string;
  thumbUrl?: string;
}

export interface ProjectImage {
  uploadId: number;
  url: string;
  thumbUrl?: string;
}

export type SocialPlatform = "twitter" | "instagram" | "youtube";

export interface SocialLinks {
  twitter: string;
  instagram: string;
  youtube: string;
}

export interface BrandPersonalizationState {
  // State
  logo: BrandLogo | null;
  selectedThemeId: number | null;
  socialLinks: SocialLinks;
  projectImages: ProjectImage[];
  logoError: string | null;
  projectImagesError: string | null;
  isUploadingLogo: boolean;
  uploadingImageIds: Set<string>;

  // Actions
  setLogo: (logo: BrandLogo) => void;
  removeLogo: () => void;
  setTheme: (themeId: number | null) => void;
  setSocialLink: (platform: SocialPlatform, url: string) => void;
  setProjectImages: (images: ProjectImage[]) => void;
  addProjectImage: (image: ProjectImage) => void;
  removeProjectImage: (uploadId: number) => void;
  setLogoError: (error: string | null) => void;
  setProjectImagesError: (error: string | null) => void;
  setIsUploadingLogo: (isUploading: boolean) => void;
  addUploadingImageId: (id: string) => void;
  removeUploadingImageId: (id: string) => void;
  reset: () => void;
}

// API action types (these need jwt and optionally websiteId)
export interface BrandPersonalizationApiActions {
  uploadLogo: (file: File, jwt: string, websiteId?: number) => Promise<BrandLogo>;
  uploadProjectImage: (file: File, tempId: string, jwt: string, websiteId?: number) => Promise<ProjectImage>;
  deleteLogo: (uploadId: number, jwt: string) => Promise<void>;
  deleteProjectImage: (uploadId: number, jwt: string) => Promise<void>;
  fetchThemes: (jwt: string) => Promise<GetThemesResponse>;
  createTheme: (name: string, colors: string[], jwt: string) => Promise<CreateThemeResponse>;
}

export type BrandPersonalizationStore = BrandPersonalizationState;

const MAX_PROJECT_IMAGES = 10;

const createInitialState = () => ({
  logo: null,
  selectedThemeId: null,
  socialLinks: {
    twitter: "",
    instagram: "",
    youtube: "",
  },
  projectImages: [],
  logoError: null,
  projectImagesError: null,
  isUploadingLogo: false,
  uploadingImageIds: new Set<string>(),
});

/**
 * Singleton Zustand store for brand personalization state.
 * Components subscribe directly with selectors for optimal re-renders.
 */
export const brandPersonalizationStore = create<BrandPersonalizationState>()(
  subscribeWithSelector((set, get) => ({
    ...createInitialState(),

    setLogo: (logo) => set({ logo, logoError: null }),

    removeLogo: () => set({ logo: null }),

    setTheme: (themeId) => set({ selectedThemeId: themeId }),

    setSocialLink: (platform, url) =>
      set((state) => ({
        socialLinks: { ...state.socialLinks, [platform]: url },
      })),

    setProjectImages: (images) => set({ projectImages: images, projectImagesError: null }),

    addProjectImage: (image) => {
      const { projectImages } = get();
      if (projectImages.length >= MAX_PROJECT_IMAGES) {
        set({ projectImagesError: `Maximum ${MAX_PROJECT_IMAGES} images allowed` });
        return;
      }
      set((state) => ({
        projectImages: [...state.projectImages, image],
        projectImagesError: null,
      }));
    },

    removeProjectImage: (uploadId) =>
      set((state) => ({
        projectImages: state.projectImages.filter((img) => img.uploadId !== uploadId),
        projectImagesError: null,
      })),

    setLogoError: (logoError) => set({ logoError }),

    setProjectImagesError: (projectImagesError) => set({ projectImagesError }),

    setIsUploadingLogo: (isUploadingLogo) => set({ isUploadingLogo }),

    addUploadingImageId: (id) =>
      set((state) => ({
        uploadingImageIds: new Set([...state.uploadingImageIds, id]),
      })),

    removeUploadingImageId: (id) =>
      set((state) => {
        const newSet = new Set(state.uploadingImageIds);
        newSet.delete(id);
        return { uploadingImageIds: newSet };
      }),

    reset: () => set(createInitialState()),
  }))
);

/**
 * Hook to access brand personalization state with selectors.
 * Only re-renders when the selected state changes.
 */
export function useBrandPersonalizationStore<T>(
  selector: (state: BrandPersonalizationState) => T
): T {
  return useStore(brandPersonalizationStore, selector);
}

// API functions that need jwt passed as parameter
// These are NOT part of the store - they're standalone functions

/**
 * Upload a logo file. Returns the uploaded logo data.
 */
export async function uploadLogo(
  file: File,
  jwt: string,
  websiteId?: number
): Promise<BrandLogo> {
  const uploadService = new UploadService({ jwt });
  const response: CreateUploadResponse = await uploadService.create({
    "upload[file]": file,
    "upload[is_logo]": true,
    "upload[website_id]": websiteId,
  });

  return {
    uploadId: response.id,
    url: response.url,
    thumbUrl: response.thumb_url ?? undefined,
  };
}

/**
 * Upload a project image file. Returns the uploaded image data.
 */
export async function uploadProjectImage(
  file: File,
  _tempId: string,
  jwt: string,
  websiteId?: number
): Promise<ProjectImage> {
  const uploadService = new UploadService({ jwt });
  const response: CreateUploadResponse = await uploadService.create({
    "upload[file]": file,
    "upload[is_logo]": false,
    "upload[website_id]": websiteId,
  });

  return {
    uploadId: response.id,
    url: response.url,
    thumbUrl: response.thumb_url ?? undefined,
  };
}

/**
 * Delete a logo by upload ID.
 */
export async function deleteLogo(uploadId: number, jwt: string): Promise<void> {
  const uploadService = new UploadService({ jwt });
  await uploadService.delete(uploadId);
}

/**
 * Delete a project image by upload ID.
 */
export async function deleteProjectImage(uploadId: number, jwt: string): Promise<void> {
  const uploadService = new UploadService({ jwt });
  await uploadService.delete(uploadId);
}

/**
 * Fetch all themes.
 */
export async function fetchThemes(jwt: string): Promise<GetThemesResponse> {
  const themeService = new ThemeService({ jwt });
  return themeService.get();
}

/**
 * Create a new theme.
 */
export async function createTheme(
  name: string,
  colors: string[],
  jwt: string
): Promise<CreateThemeResponse> {
  const themeService = new ThemeService({ jwt });
  return themeService.create({
    theme: {
      name,
      colors,
    },
  });
}

// Selectors for fine-grained subscriptions
export const selectLogo = (s: BrandPersonalizationState) => s.logo;
export const selectSelectedThemeId = (s: BrandPersonalizationState) => s.selectedThemeId;
export const selectSocialLinks = (s: BrandPersonalizationState) => s.socialLinks;
export const selectProjectImages = (s: BrandPersonalizationState) => s.projectImages;
export const selectLogoError = (s: BrandPersonalizationState) => s.logoError;
export const selectProjectImagesError = (s: BrandPersonalizationState) => s.projectImagesError;
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
