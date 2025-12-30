# feat: Implement Brand Personalization Panel

## Overview

Implement the complete Brand Personalization panel in the brainstorm UI based on the Figma design. The panel allows users to optionally customize their brand settings including logo upload, color palette selection/creation, social links, and product images.

## Problem Statement / Motivation

Currently, the `BrandPersonalizationPanel` component (`app/javascript/frontend/components/brainstorm/BrandPersonalizationPanel.tsx`) only has placeholder content. Users need the ability to:

1. Upload their brand logo for use on generated landing pages
2. Select from predefined color palettes or create custom ones
3. Add social media links (Twitter, Instagram, YouTube)
4. Upload product images for use in the landing page

This feature enables personalized, on-brand landing page generation that reflects the user's existing brand identity.

## Proposed Solution

Build out the Brand Personalization panel with four sections matching the Figma design:

1. **Logo Upload** - Single image upload with preview/replace/remove
2. **Colors** - Paginated palette browser with custom palette creation
3. **Social Links** - URL inputs for major platforms
4. **Images** - Multi-file product image uploader

Leverage existing APIs (Uploads, Themes) which are already documented via RSwag.

## Technical Approach

### Architecture

```
app/javascript/frontend/
├── components/brainstorm/
│   ├── BrandPersonalizationPanel.tsx          # Main container (update)
│   └── brand/
│       ├── LogoUploadSection.tsx              # Logo upload area
│       ├── ColorPaletteSection.tsx            # Color palettes + custom
│       ├── SocialLinksSection.tsx             # URL inputs
│       ├── ProductImagesSection.tsx           # Multi-image upload
│       └── ColorPalettePicker.tsx             # Custom palette modal
├── stores/
│   └── brandPersonalization.ts                # Zustand store for state
└── api/
    ├── uploads.ts                             # (existing)
    └── themes.ts                              # (existing)
```

### Data Model

The brand personalization data should be scoped **per-project** and stored in the existing project/website context. The data includes:

```typescript
interface BrandPersonalization {
  logo?: {
    uploadId: number;
    url: string;
    thumbUrl?: string;
  };
  selectedThemeId?: number;
  customColors?: string[]; // Array of 5 hex colors
  socialLinks: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
  productImages: Array<{
    uploadId: number;
    url: string;
    thumbUrl?: string;
  }>;
}
```

### Implementation Phases

#### Phase 1: Foundation & Logo Upload

**Files to create/modify:**

1. `app/javascript/frontend/stores/brandPersonalization.ts`
   - Zustand store with persist middleware
   - Actions: setLogo, removeLogo, setTheme, setColors, setSocialLinks, addProductImage, removeProductImage

2. `app/javascript/frontend/components/brainstorm/brand/LogoUploadSection.tsx`
   - Dashed border upload area (234x104px)
   - Upload icon centered with "Add your logo here" text
   - File type hint: "PNG, JPG or SVG"
   - Click-to-upload and drag-and-drop support
   - On upload: call `UploadService.create()` with `is_logo: true`
   - After upload: show thumbnail with hover overlay for Replace/Remove

3. Update `BrandPersonalizationPanel.tsx`
   - Import and render LogoUploadSection
   - Connect to brandPersonalization store

**Acceptance Criteria:**
- [ ] Empty state shows dashed border with upload icon and text
- [ ] Click opens file picker (accept: image/png, image/jpeg, image/svg+xml)
- [ ] Drag-and-drop highlights zone and uploads on drop
- [ ] Upload shows loading spinner (reuse existing ImageThumbnail pattern)
- [ ] Completed upload shows thumbnail preview
- [ ] Hover on thumbnail shows Replace/Remove actions
- [ ] Replace uploads new file and removes old reference
- [ ] Remove clears the logo

#### Phase 2: Color Palette Selection

**Files to create/modify:**

1. `app/javascript/frontend/components/brainstorm/brand/ColorPaletteSection.tsx`
   - Section header "Colors" with pagination controls (< 1/N >)
   - Fetch themes from `ThemeService.get()`
   - Display 3 palette rows per page (based on Figma showing 3 rows)
   - Each row: 5 color swatches with rounded corners on first/last
   - Click palette row to select (visual indicator: border or checkmark)
   - "Add Custom" button at bottom-right

2. `app/javascript/frontend/components/brainstorm/brand/ColorPalettePicker.tsx`
   - Modal/popover for creating custom palette
   - 5 color pickers (using native `<input type="color">` or react-colorful)
   - Hex input for each color
   - Save creates new theme via `ThemeService.create()`
   - Cancel closes without saving

**Acceptance Criteria:**
- [ ] Displays color palettes from API in rows of 5 colors
- [ ] Pagination works (previous/next arrows, page indicator)
- [ ] Clicking a palette row selects it (visual feedback)
- [ ] Selected palette persists in store
- [ ] "Add Custom" opens color picker modal
- [ ] Custom palette can be saved with 5 colors
- [ ] Custom palettes appear in the list after creation

#### Phase 3: Social Links

**Files to create/modify:**

1. `app/javascript/frontend/components/brainstorm/brand/SocialLinksSection.tsx`
   - Section header "Social Links"
   - Three input fields with link icon prefix:
     - Twitter URL (placeholder: "Twitter URL")
     - Instagram URL (placeholder: "Instagram URL")
     - YouTube URL (placeholder: "Youtube URL")
   - Use existing Input component styling
   - Auto-save on blur with debounce
   - URL validation (must be valid URL format)

**Acceptance Criteria:**
- [ ] Three input fields with link icons displayed
- [ ] Placeholder text matches Figma
- [ ] Input styling matches existing UI components
- [ ] URLs validated on blur (show inline error if invalid)
- [ ] Valid URLs saved to store
- [ ] All fields optional (empty values allowed)

#### Phase 4: Product Images

**Files to create/modify:**

1. `app/javascript/frontend/components/brainstorm/brand/ProductImagesSection.tsx`
   - Section header "Images"
   - Dashed border upload area (similar to logo but for multiple files)
   - "Add product images here" text with file type hint
   - Support multiple file upload (up to 10 images)
   - After upload: show grid of thumbnails (3 per row)
   - Each thumbnail has remove button on hover
   - Click upload area to add more images

**Acceptance Criteria:**
- [ ] Empty state shows dashed border with upload icon
- [ ] Multi-file selection supported in file picker
- [ ] Drag-and-drop multiple files supported
- [ ] Each file uploads independently with loading state
- [ ] Completed uploads show in thumbnail grid
- [ ] Hover on thumbnail shows remove button
- [ ] Maximum 10 images enforced (show message if exceeded)
- [ ] Can add more images by clicking upload area again

#### Phase 5: Integration & Polish

**Tasks:**

1. Wire up all sections to pass data to brainstorm chat/API
2. Add loading skeletons for initial data fetch
3. Ensure panel state persists across page navigation
4. Add error handling and retry logic for failed uploads
5. Test responsive behavior on different screen sizes

**Acceptance Criteria:**
- [ ] All sections work together in the panel
- [ ] Data persists when navigating away and back
- [ ] Loading states show while fetching existing data
- [ ] Errors display user-friendly messages
- [ ] Panel is usable on tablet-sized screens

## MVP Implementation

### LogoUploadSection.tsx

```tsx
import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { UploadService } from "@/api/uploads";
import { useBrandPersonalization } from "@/stores/brandPersonalization";

export function LogoUploadSection() {
  const { logo, setLogo, removeLogo } = useBrandPersonalization();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const response = await new UploadService().create({
        "upload[file]": file,
        "upload[is_logo]": true,
      });
      setLogo({
        uploadId: response.id,
        url: response.url,
        thumbUrl: response.thumb_url,
      });
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // ... drag/drop handlers, render logic
}
```

### ColorPaletteSection.tsx

```tsx
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ThemeService } from "@/api/themes";
import { useBrandPersonalization } from "@/stores/brandPersonalization";

const PALETTES_PER_PAGE = 3;

export function ColorPaletteSection() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const { selectedThemeId, setTheme } = useBrandPersonalization();

  useEffect(() => {
    ThemeService.get().then(setThemes);
  }, []);

  const totalPages = Math.ceil(themes.length / PALETTES_PER_PAGE);
  const visibleThemes = themes.slice(
    currentPage * PALETTES_PER_PAGE,
    (currentPage + 1) * PALETTES_PER_PAGE
  );

  // ... render palette rows, pagination, custom picker modal
}
```

### brandPersonalization.ts (Zustand Store)

**Important Note:** This store is for **UI state management only** - it tracks which uploads/themes the user has selected in the current session. The actual data persistence happens via the existing APIs:
- Uploads are stored server-side via `POST /api/v1/uploads`
- Themes are stored server-side via `POST /api/v1/themes`
- Social links will be stored on the project/website model

The store should be **scoped per-project** using a factory function pattern (not a global singleton) to prevent data leaking between projects.

```typescript
import { createStore, useStore } from "zustand";
import type { StoreApi } from "zustand";

interface Logo {
  uploadId: number;
  url: string;
  thumbUrl?: string;
}

interface ProductImage {
  uploadId: number;
  url: string;
  thumbUrl?: string;
}

interface BrandPersonalizationState {
  projectId: string | null;
  logo: Logo | null;
  selectedThemeId: number | null;
  socialLinks: {
    twitter: string;
    instagram: string;
    youtube: string;
  };
  productImages: ProductImage[];
  error: string | null;
  isUploading: boolean;

  // Actions
  setProjectId: (projectId: string) => void;
  setLogo: (logo: Logo) => void;
  removeLogo: () => void;
  setTheme: (themeId: number) => void;
  setSocialLink: (platform: "twitter" | "instagram" | "youtube", url: string) => void;
  addProductImage: (image: ProductImage) => void;
  removeProductImage: (uploadId: number) => void;
  setError: (error: string | null) => void;
  setIsUploading: (isUploading: boolean) => void;
  reset: () => void;
}

const createInitialState = (projectId: string | null = null) => ({
  projectId,
  logo: null,
  selectedThemeId: null,
  socialLinks: {
    twitter: "",
    instagram: "",
    youtube: "",
  },
  productImages: [],
  error: null,
  isUploading: false,
});

export const createBrandPersonalizationStore = (projectId: string | null = null) => {
  return createStore<BrandPersonalizationState>((set) => ({
    ...createInitialState(projectId),

    setProjectId: (projectId) => set({ projectId }),
    setLogo: (logo) => set({ logo, error: null }),
    removeLogo: () => set({ logo: null }),
    setTheme: (themeId) => set({ selectedThemeId: themeId }),
    setSocialLink: (platform, url) =>
      set((state) => ({
        socialLinks: { ...state.socialLinks, [platform]: url },
      })),
    addProductImage: (image) =>
      set((state) => ({
        productImages: [...state.productImages, image],
        error: state.productImages.length >= 10 ? "Maximum 10 images allowed" : null,
      })),
    removeProductImage: (uploadId) =>
      set((state) => ({
        productImages: state.productImages.filter((img) => img.uploadId !== uploadId),
        error: null,
      })),
    setError: (error) => set({ error }),
    setIsUploading: (isUploading) => set({ isUploading }),
    reset: () => set(createInitialState()),
  }));
};

// Type for the store
export type BrandPersonalizationStore = StoreApi<BrandPersonalizationState>;
```

## Dependencies & Prerequisites

### Existing APIs (Already Implemented)
- **Uploads API** (`/api/v1/uploads`) - POST for file upload, documented in RSwag
- **Themes API** (`/api/v1/themes`) - GET for listing, POST for creating custom themes

### Existing Components to Reuse
- `ImageThumbnail` - For upload previews with loading states
- `Input` - For social link text fields
- `Field`, `FieldLabel` - For form field wrappers
- Upload patterns from `brainstormInput.ts` store

### New Dependencies
- `react-colorful` (optional) - For custom color picker if native input is insufficient
  - Alternative: Use native `<input type="color">` to avoid new dependencies

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| File upload failures on slow networks | Medium | Medium | Show progress indicator, retry button, clear error messages |
| Color picker accessibility issues | Low | Medium | Use native input or accessible library, add keyboard navigation |
| State loss on navigation | Medium | High | Use Zustand persist middleware, auto-save on changes |
| API schema changes | Low | Medium | Use existing TypeScript types from generated API client |

## Success Metrics

- Users can upload logo and see it in their generated landing pages
- Users can select or create color palettes that apply to generated pages
- Social links entered are included in generated landing pages
- Product images uploaded appear in relevant sections of landing pages

## Test Plan (Playwright E2E)

### Test File Structure

```
e2e/
├── brainstorm.spec.ts                    # (existing - add brand panel tests here)
└── pages/
    └── brainstorm.page.ts                # (existing - add brand panel locators)
```

### Page Object Additions (brainstorm.page.ts)

```typescript
// Add to BrainstormPage class:

// Brand Personalization Panel
readonly brandPanel: Locator;
readonly brandPanelToggle: Locator;

// Logo Section
readonly logoUploadArea: Locator;
readonly logoPreview: Locator;
readonly logoRemoveButton: Locator;

// Colors Section
readonly colorPalettes: Locator;
readonly colorPaginationPrev: Locator;
readonly colorPaginationNext: Locator;
readonly colorPaginationLabel: Locator;
readonly addCustomColorButton: Locator;
readonly customColorModal: Locator;
readonly colorInputs: Locator;
readonly saveCustomPaletteButton: Locator;

// Social Links Section
readonly twitterInput: Locator;
readonly instagramInput: Locator;
readonly youtubeInput: Locator;

// Images Section
readonly productImagesUploadArea: Locator;
readonly productImageThumbnails: Locator;

constructor(page: Page) {
  // ... existing locators ...

  // Brand Personalization Panel
  this.brandPanel = page.getByTestId("brand-personalization-panel");
  this.brandPanelToggle = page.getByRole("button", { name: /Brand Personalization/i });

  // Logo
  this.logoUploadArea = page.getByTestId("logo-upload-area");
  this.logoPreview = page.getByTestId("logo-preview");
  this.logoRemoveButton = page.getByTestId("logo-remove-button");

  // Colors
  this.colorPalettes = page.getByTestId("color-palette");
  this.colorPaginationPrev = page.getByTestId("color-pagination-prev");
  this.colorPaginationNext = page.getByTestId("color-pagination-next");
  this.colorPaginationLabel = page.getByTestId("color-pagination-label");
  this.addCustomColorButton = page.getByRole("button", { name: /Add Custom/i });
  this.customColorModal = page.getByTestId("custom-color-modal");
  this.colorInputs = page.locator('input[type="color"]');
  this.saveCustomPaletteButton = page.getByRole("button", { name: /Save/i });

  // Social Links
  this.twitterInput = page.getByPlaceholder("Twitter URL");
  this.instagramInput = page.getByPlaceholder("Instagram URL");
  this.youtubeInput = page.getByPlaceholder("Youtube URL");

  // Images
  this.productImagesUploadArea = page.getByTestId("product-images-upload-area");
  this.productImageThumbnails = page.getByTestId("product-image-thumbnail");
}

// Helper methods
async expandBrandPanel(): Promise<void> {
  const isExpanded = await this.brandPanel.locator('[data-expanded="true"]').count() > 0;
  if (!isExpanded) {
    await this.brandPanelToggle.click();
  }
}

async uploadLogo(filePath: string): Promise<void> {
  await this.expandBrandPanel();
  const fileInput = this.page.locator('input[type="file"][data-testid="logo-file-input"]');
  await fileInput.setInputFiles(filePath);
}

async uploadProductImages(filePaths: string[]): Promise<void> {
  await this.expandBrandPanel();
  const fileInput = this.page.locator('input[type="file"][data-testid="product-images-file-input"]');
  await fileInput.setInputFiles(filePaths);
}
```

### Test Cases (brainstorm.spec.ts)

```typescript
test.describe("Brand Personalization Panel", () => {
  let brainstormPage: BrainstormPage;

  test.beforeEach(async ({ page }) => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
    await loginUser(page);
    brainstormPage = new BrainstormPage(page);
    await brainstormPage.goto();
  });

  test.describe("Panel Toggle", () => {
    test("panel is collapsed by default", async ({ page }) => {
      await expect(brainstormPage.brandPanelToggle).toBeVisible();
      await expect(brainstormPage.logoUploadArea).not.toBeVisible();
    });

    test("clicking toggle expands panel", async ({ page }) => {
      await brainstormPage.brandPanelToggle.click();
      await expect(brainstormPage.logoUploadArea).toBeVisible();
      await expect(brainstormPage.colorPalettes.first()).toBeVisible();
      await expect(brainstormPage.twitterInput).toBeVisible();
    });

    test("clicking toggle again collapses panel", async ({ page }) => {
      await brainstormPage.brandPanelToggle.click();
      await expect(brainstormPage.logoUploadArea).toBeVisible();

      await brainstormPage.brandPanelToggle.click();
      await page.waitForTimeout(300); // Animation
      await expect(brainstormPage.logoUploadArea).not.toBeVisible();
    });
  });

  test.describe("Logo Upload", () => {
    test("uploads logo and shows preview", async ({ page }) => {
      await brainstormPage.uploadLogo("e2e/fixtures/files/test-logo.png");

      // Wait for upload to complete
      await expect(brainstormPage.logoPreview).toBeVisible({ timeout: 10000 });
    });

    test("shows loading state during upload", async ({ page }) => {
      await brainstormPage.expandBrandPanel();

      // Slow down network to observe loading state
      await page.route("**/api/v1/uploads", async (route) => {
        await page.waitForTimeout(1000);
        await route.continue();
      });

      await brainstormPage.uploadLogo("e2e/fixtures/files/test-logo.png");

      // Should show loading indicator
      await expect(page.getByTestId("logo-upload-loading")).toBeVisible();
    });

    test("can remove uploaded logo", async ({ page }) => {
      await brainstormPage.uploadLogo("e2e/fixtures/files/test-logo.png");
      await expect(brainstormPage.logoPreview).toBeVisible({ timeout: 10000 });

      // Hover to reveal remove button
      await brainstormPage.logoPreview.hover();
      await brainstormPage.logoRemoveButton.click();

      // Preview should be gone, upload area visible
      await expect(brainstormPage.logoPreview).not.toBeVisible();
      await expect(brainstormPage.logoUploadArea).toBeVisible();
    });

    test("shows error for invalid file type", async ({ page }) => {
      await brainstormPage.expandBrandPanel();
      const fileInput = page.locator('input[type="file"][data-testid="logo-file-input"]');

      // Try to upload a text file
      await fileInput.setInputFiles({
        name: "test.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not an image"),
      });

      // Should show error message
      await expect(page.getByText(/Invalid file type/i)).toBeVisible();
    });
  });

  test.describe("Color Palettes", () => {
    test("displays predefined color palettes", async ({ page }) => {
      await brainstormPage.expandBrandPanel();

      // Should show at least one palette
      await expect(brainstormPage.colorPalettes.first()).toBeVisible();
    });

    test("pagination works", async ({ page }) => {
      await brainstormPage.expandBrandPanel();

      // Check initial pagination state
      await expect(brainstormPage.colorPaginationLabel).toContainText("1/");

      // Click next
      await brainstormPage.colorPaginationNext.click();
      await expect(brainstormPage.colorPaginationLabel).toContainText("2/");

      // Click prev
      await brainstormPage.colorPaginationPrev.click();
      await expect(brainstormPage.colorPaginationLabel).toContainText("1/");
    });

    test("clicking palette selects it", async ({ page }) => {
      await brainstormPage.expandBrandPanel();

      const firstPalette = brainstormPage.colorPalettes.first();
      await firstPalette.click();

      // Should have selected state
      await expect(firstPalette).toHaveAttribute("data-selected", "true");
    });

    test("can create custom color palette", async ({ page }) => {
      await brainstormPage.expandBrandPanel();

      await brainstormPage.addCustomColorButton.click();
      await expect(brainstormPage.customColorModal).toBeVisible();

      // Fill in 5 colors
      const colorInputs = await brainstormPage.colorInputs.all();
      expect(colorInputs.length).toBe(5);

      for (let i = 0; i < 5; i++) {
        await colorInputs[i].fill(`#${(i + 1).toString().padStart(2, "0")}0000`);
      }

      // Save
      await brainstormPage.saveCustomPaletteButton.click();

      // Modal should close and new palette should appear
      await expect(brainstormPage.customColorModal).not.toBeVisible();
    });
  });

  test.describe("Social Links", () => {
    test("can enter Twitter URL", async ({ page }) => {
      await brainstormPage.expandBrandPanel();

      await brainstormPage.twitterInput.fill("https://twitter.com/testuser");
      await brainstormPage.twitterInput.blur();

      // Should save successfully (no error shown)
      await expect(page.getByText(/Invalid URL/i)).not.toBeVisible();
    });

    test("shows validation error for invalid URL", async ({ page }) => {
      await brainstormPage.expandBrandPanel();

      await brainstormPage.twitterInput.fill("not-a-valid-url");
      await brainstormPage.twitterInput.blur();

      // Should show validation error
      await expect(page.getByText(/Invalid URL/i)).toBeVisible();
    });

    test("all three social inputs are present", async ({ page }) => {
      await brainstormPage.expandBrandPanel();

      await expect(brainstormPage.twitterInput).toBeVisible();
      await expect(brainstormPage.instagramInput).toBeVisible();
      await expect(brainstormPage.youtubeInput).toBeVisible();
    });
  });

  test.describe("Product Images", () => {
    test("can upload multiple images", async ({ page }) => {
      await brainstormPage.uploadProductImages([
        "e2e/fixtures/files/product1.png",
        "e2e/fixtures/files/product2.png",
      ]);

      // Should show 2 thumbnails
      await expect(brainstormPage.productImageThumbnails).toHaveCount(2, { timeout: 15000 });
    });

    test("can remove individual product image", async ({ page }) => {
      await brainstormPage.uploadProductImages(["e2e/fixtures/files/product1.png"]);
      await expect(brainstormPage.productImageThumbnails).toHaveCount(1, { timeout: 10000 });

      // Hover and click remove
      await brainstormPage.productImageThumbnails.first().hover();
      await page.getByTestId("product-image-remove").first().click();

      // Should be removed
      await expect(brainstormPage.productImageThumbnails).toHaveCount(0);
    });

    test("enforces maximum of 10 images", async ({ page }) => {
      await brainstormPage.expandBrandPanel();

      // Upload 10 images
      const files = Array.from({ length: 10 }, (_, i) => `e2e/fixtures/files/product${i + 1}.png`);
      await brainstormPage.uploadProductImages(files);

      await expect(brainstormPage.productImageThumbnails).toHaveCount(10, { timeout: 30000 });

      // Try to add 11th - should show error
      await brainstormPage.uploadProductImages(["e2e/fixtures/files/product-extra.png"]);
      await expect(page.getByText(/Maximum 10 images/i)).toBeVisible();
    });
  });

  test.describe("Accessibility", () => {
    test("panel toggle is keyboard accessible", async ({ page }) => {
      await brainstormPage.brandPanelToggle.focus();
      await page.keyboard.press("Enter");

      await expect(brainstormPage.logoUploadArea).toBeVisible();
    });

    test("color palettes can be selected with keyboard", async ({ page }) => {
      await brainstormPage.expandBrandPanel();

      // Tab to first palette and select with Enter
      await brainstormPage.colorPalettes.first().focus();
      await page.keyboard.press("Enter");

      await expect(brainstormPage.colorPalettes.first()).toHaveAttribute("data-selected", "true");
    });
  });
});
```

### Test Fixtures Required

Create test image files in `e2e/fixtures/files/`:
- `test-logo.png` - 200x200px PNG
- `product1.png` through `product10.png` - Product images
- `product-extra.png` - For overflow test

## References

### Internal References
- Existing panel: `app/javascript/frontend/components/brainstorm/BrandPersonalizationPanel.tsx:1-49`
- Upload model: `app/models/upload.rb:24-75`
- Upload API: `app/controllers/api/v1/uploads_controller.rb:1-30`
- Theme model: `app/models/theme.rb:1-58`
- Theme API: `app/controllers/api/v1/themes_controller.rb:1-22`
- Attachment upload pattern: `app/javascript/frontend/stores/brainstormInput.ts:1-148`
- ImageThumbnail component: `app/javascript/frontend/components/brainstorm/attachments/ImageThumbnail.tsx:1-112`
- Input component: `app/javascript/frontend/components/ui/input.tsx:1-21`

### RSwag API Documentation
- Uploads spec: `spec/requests/uploads_spec.rb:1-296`
- Themes spec: `spec/requests/themes_spec.rb:1-135`
- Upload schema: `spec/support/schemas/upload_schemas.rb:1-31`
- Theme schema: `spec/support/schemas/theme_schemas.rb:1-53`

### External References
- [react-colorful](https://github.com/omgovich/react-colorful) - Lightweight color picker
- [Zustand persist middleware](https://docs.pmnd.rs/zustand/integrations/persisting-store-data)

---

## Design Reference

The Figma design shows:

1. **Logo Section**: Dashed border box (234x104px), upload icon, "Add your logo here", "PNG, JPG or SVG" hint

2. **Colors Section**:
   - Header with "Colors" and pagination "< 1/2 >"
   - 3 rows of 5 color swatches each
   - Color swatches are ~47px wide, 32px tall
   - First swatch has rounded left corners, last has rounded right corners
   - "Add Custom" button with plus icon

3. **Social Links Section**:
   - Header "Social Links"
   - Three inputs with link icons: Twitter URL, Instagram URL, Youtube URL
   - Standard input field styling (white bg, border, rounded corners)

4. **Images Section**:
   - Dashed border box similar to logo
   - "Add product images here" with "PNG, JPG or SVG" hint
