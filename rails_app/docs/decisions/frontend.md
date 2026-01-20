# Frontend: Decision History

> Decisions about React components, Inertia, UI patterns, and client-side behavior. Most recent first.

---

## Current State

React + Inertia.js + Vite. Tailwind CSS v4 with custom design tokens.
Radix UI primitives with CVA for variants.
**Icons (internal app):** Heroicons (from Tailwind Labs).
**Icons (user-generated sites):** Lucide icons.
**Illustrations:** Streamline Milano style (PNG, free tier).
File uploads validated client-side before upload, with immediate upload on selection.
**CSS Effects:** Use CSS `mask-image` with gradients for fade effects on borders/shadows.

---

## Decision Log

### 2025-01-20: CSS Mask Fade Technique for Border/Shadow Effects

**Context:** Website builder footer needed a border and shadow that:
- Fades out smoothly on the left side (no hard edge)
- Extends fully to the right edge of the screen
- Keeps button content aligned with the preview column

**Decision:** Use CSS `mask-image` with a gradient to create fade effects on borders and shadows.

**Implementation:**

1. **Separate border from container** - Create a dedicated div for the border line instead of using `border-t` on the container:
```tsx
<div
  className="h-px bg-neutral-200 -ml-8 -mr-[2.5vw] shadow-[...]"
  style={{
    maskImage: "linear-gradient(to right, transparent, black 32px)",
    WebkitMaskImage: "linear-gradient(to right, transparent, black 32px)",
  }}
/>
```

2. **Gradient mask** - The mask transitions from `transparent` (hidden) to `black` (visible) over 32px:
   - `transparent` at start = border invisible
   - `black` at 32px = border fully visible
   - Both the border AND shadow fade together

3. **Negative margins for reach**:
   - `-ml-8` extends 32px left (into the fade zone)
   - `-mr-[2.5vw]` extends to the right screen edge

4. **Overlap technique** - Preview uses negative bottom margin to slide behind the footer for seamless visual transition.

**Why:**
- Clean visual effect without complex SVG or canvas
- Works with any border color or shadow
- GPU-accelerated (compositing layer)
- Pure CSS, no JavaScript needed
- Shadow fades naturally with the same mask

**Alternatives considered:**
- **Gradient border-image**: Can't apply to shadows, only borders. Rejected.
- **Pseudo-element with gradient background**: More complex, harder to maintain. Rejected.
- **SVG mask**: Overkill for a simple linear fade. Rejected.

**Trade-offs:**
- Requires vendor prefix (`-webkit-mask-image`) for Safari
- Mask prevents interaction with masked area (not an issue for decorative borders)

**Used in:** `WebsitePaginationFooter` component (`Website.tsx`)

**Status:** Current

---

### 2025-12-30: Icon and Illustration Libraries

**Context:** Need consistent visual assets across the internal Launch10 app and user-generated landing pages.

**Decision:** Use different icon libraries for different contexts:

**Icons:**
- **Internal app (Launch10 UI):** [Heroicons](https://github.com/tailwindlabs/heroicons) from Tailwind Labs
- **User-generated sites (landing pages):** Lucide icons

**Illustrations:**
- **Source:** [Streamline Milano](https://www.streamlinehq.com/illustrations/milano) style
- **Format:** PNG (free tier) - download and recolor in Figma as needed
- **Note:** SVG versions require paid Streamline plan, avoiding for now

**Why:**
- Heroicons integrate seamlessly with Tailwind CSS (same team)
- Lucide already established in landing page generation templates
- Milano illustrations have a clean, modern aesthetic that fits our brand
- PNG recoloring in Figma is a viable workaround for the free tier

**Trade-offs:**
- Two icon libraries to maintain awareness of (internal vs generated)
- PNG illustrations require manual recoloring (no programmatic color changes)

**Status:** Current

---

### 2025-12-29: Frontend File Type Validation for Brainstorm Uploads

**Context:** Implementing file attachments in brainstorm chat. Backend (MediaUploader) already validates, but we want fast client-side feedback.

**Decision:** Validate file types and sizes on the frontend before upload:

**Allowed types:**
- Images: JPEG, PNG, GIF, WebP, SVG
- Documents: PDF only

**Size limits:**
- Images: 100MB max
- PDFs: 50MB max

**Behavior:**
- Invalid files show toast error immediately
- Valid files start uploading immediately (no "upload on send")
- File input `accept` attribute restricts file picker
- DropZone validates dropped files same as selected files

**Why:**
- Fast feedback - user knows immediately if file won't work
- Reduces unnecessary API calls for invalid files
- Matches backend validation (single source of truth for allowed types)
- Immediate upload provides better UX (progress visible, ready when user sends)

**Trade-offs:**
- Duplicates validation logic (frontend + backend) - acceptable for UX
- Must keep in sync with backend allowed types - mitigated by clear constants

**Status:** Current

---

### 2025-12-29: Immediate File Upload on Selection

**Context:** User selects files via FilePlus button or drag & drop. When should upload start?

**Decision:** Upload immediately when file is selected/dropped, not when message is sent.

**Why:**
- User sees upload progress immediately
- Files are ready (completed) when user hits send
- Parallel work: user can type message while files upload
- Better perceived performance

**Alternatives considered:**
- **Upload on send**: Simpler state, but delays message sending. User waits for upload + AI response. Rejected.
- **Background queue**: Over-engineered for this use case. Rejected.

**Trade-offs:**
- User might upload then delete without sending (wasted bandwidth) - acceptable
- Must handle "uploading" state in UI (spinner, no X button during upload)

**Status:** Current

---
