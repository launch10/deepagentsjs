import { create } from "zustand";
import { useStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

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
