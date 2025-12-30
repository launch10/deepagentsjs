import { createStore, type StoreApi } from "zustand";

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
  error: string | null;
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
  setError: (error: string | null) => void;
  setIsUploadingLogo: (isUploading: boolean) => void;
  addUploadingImageId: (id: string) => void;
  removeUploadingImageId: (id: string) => void;
  reset: () => void;
}

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
  error: null,
  isUploadingLogo: false,
  uploadingImageIds: new Set<string>(),
});

export const createBrandPersonalizationStore = () => {
  return createStore<BrandPersonalizationState>((set, get) => ({
    ...createInitialState(),

    setLogo: (logo) => set({ logo, error: null }),

    removeLogo: () => set({ logo: null }),

    setTheme: (themeId) => set({ selectedThemeId: themeId }),

    setSocialLink: (platform, url) =>
      set((state) => ({
        socialLinks: { ...state.socialLinks, [platform]: url },
      })),

    setProjectImages: (images) => set({ projectImages: images, error: null }),

    addProjectImage: (image) => {
      const { projectImages } = get();
      if (projectImages.length >= MAX_PROJECT_IMAGES) {
        set({ error: `Maximum ${MAX_PROJECT_IMAGES} images allowed` });
        return;
      }
      set((state) => ({
        projectImages: [...state.projectImages, image],
        error: null,
      }));
    },

    removeProjectImage: (uploadId) =>
      set((state) => ({
        projectImages: state.projectImages.filter((img) => img.uploadId !== uploadId),
        error: null,
      })),

    setError: (error) => set({ error }),

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
  }));
};

export type BrandPersonalizationStore = ReturnType<typeof createBrandPersonalizationStore>;
export type BrandPersonalizationStoreApi = StoreApi<BrandPersonalizationState>;
