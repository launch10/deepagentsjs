import { createStore, type StoreApi } from "zustand";

export interface BrandLogo {
  uploadId: number;
  url: string;
  thumbUrl?: string;
}

export interface ProductImage {
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
  productImages: ProductImage[];
  error: string | null;
  isUploadingLogo: boolean;
  uploadingImageIds: Set<string>;

  // Actions
  setLogo: (logo: BrandLogo) => void;
  removeLogo: () => void;
  setTheme: (themeId: number | null) => void;
  setSocialLink: (platform: SocialPlatform, url: string) => void;
  addProductImage: (image: ProductImage) => void;
  removeProductImage: (uploadId: number) => void;
  setError: (error: string | null) => void;
  setIsUploadingLogo: (isUploading: boolean) => void;
  addUploadingImageId: (id: string) => void;
  removeUploadingImageId: (id: string) => void;
  reset: () => void;
}

const MAX_PRODUCT_IMAGES = 10;

const createInitialState = () => ({
  logo: null,
  selectedThemeId: null,
  socialLinks: {
    twitter: "",
    instagram: "",
    youtube: "",
  },
  productImages: [],
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

    addProductImage: (image) => {
      const { productImages } = get();
      if (productImages.length >= MAX_PRODUCT_IMAGES) {
        set({ error: `Maximum ${MAX_PRODUCT_IMAGES} images allowed` });
        return;
      }
      set((state) => ({
        productImages: [...state.productImages, image],
        error: null,
      }));
    },

    removeProductImage: (uploadId) =>
      set((state) => ({
        productImages: state.productImages.filter((img) => img.uploadId !== uploadId),
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
