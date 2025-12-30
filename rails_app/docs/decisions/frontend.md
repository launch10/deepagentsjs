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

---

## Decision Log

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
