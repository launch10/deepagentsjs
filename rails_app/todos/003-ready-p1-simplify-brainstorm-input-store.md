---
status: done
priority: p1
issue_id: "003"
tags: [architecture, simplicity, zustand, brainstorm-ui]
dependencies: []
---

# Simplify Providers to Global Zustand Stores

## Problem Statement

Two providers (`BrainstormInputProvider` and `BrandPersonalizationProvider`) wrap Zustand stores in React Context, adding unnecessary complexity. Zustand already provides smart subscriptions via selectors - components can subscribe directly to just the pieces they care about. The provider pattern here adds ceremony without value.

**Current architecture (over-engineered):**
```
store.ts → createStore factory → Provider creates instance → Context provides it → Components consume
```

**Target architecture (simple):**
```
store.ts → singleton store → Components subscribe directly with selectors
```

**Affected providers:**
1. `BrainstormInputProvider` - input text, attachments, uploads
2. `BrandPersonalizationProvider` - logo, themes, social links, project images

## Findings

**BrainstormInput files:**
- `app/javascript/frontend/stores/brainstormInput.ts` - Store factory → singleton
- `app/javascript/frontend/context/BrainstormInputProvider.tsx` - DELETE
- `app/javascript/frontend/components/brainstorm/BrainstormInputContext.tsx` - DELETE (re-export)
- `app/javascript/frontend/components/brainstorm/BrainstormConversation.tsx` - Remove provider wrapper
- `app/javascript/frontend/components/brainstorm/BrainstormLanding.tsx` - Remove provider wrapper
- `app/javascript/frontend/components/brainstorm/BrainstormInput.tsx` - Update imports
- `app/javascript/frontend/components/brainstorm/BrainstormMessages.tsx` - Update imports

**BrandPersonalization files:**
- `app/javascript/frontend/stores/brandPersonalization.ts` - Store factory → singleton
- `app/javascript/frontend/context/BrandPersonalizationProvider.tsx` - DELETE
- `app/javascript/frontend/components/brainstorm/BrainstormConversation.tsx` - Remove provider wrapper
- `app/javascript/frontend/components/brainstorm/BrandPersonalizationPanel.tsx` - Update imports

**Why provider pattern is unnecessary:**
1. Only ONE brainstorm input exists at a time (no need for scoped instances)
2. Zustand selectors provide surgical re-renders out of the box
3. The "backwards compatibility" comment is meaningless on a new feature branch
4. `BrandPersonalizationPanel` is wrapped by provider but doesn't even use it

**The only complication - JWT for uploads:**
The provider exists mainly to inject `jwt` into the upload function. Solutions:
- Pass `jwt` as parameter to `addFiles(files, jwt)`
- Fetch jwt from shared auth location (e.g., page props helper)
- Store jwt in the store itself on initialization

## Proposed Solution

### Step 1: Convert store to singleton

```typescript
// stores/brainstormInput.ts
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export const useBrainstormInputStore = create<BrainstormInputStore>()(
  subscribeWithSelector((set, get) => ({
    input: "",
    attachments: [],
    isUploading: false,

    setInput: (text) => set({ input: text }),

    // Pass jwt when adding files
    addFiles: async (files, jwt) => {
      // ... upload logic with jwt parameter
    },

    // ... rest of actions
  }))
);
```

### Step 2: Delete provider files

- Delete `context/BrainstormInputProvider.tsx`
- Delete `components/brainstorm/BrainstormInputContext.tsx`

### Step 3: Update consumers

```typescript
// Before
import { useBrainstormInput } from "./BrainstormInputContext";
const { input, setInput } = useBrainstormInput();

// After
import { useBrainstormInputStore } from "@stores/brainstormInput";
const input = useBrainstormInputStore((s) => s.input);
const setInput = useBrainstormInputStore((s) => s.setInput);
```

### Step 4: Handle textarea ref

Either:
- Module-level ref in the store file
- Pass as prop to BrainstormInput
- Create minimal `useBrainstormTextareaRef` hook

## Acceptance Criteria

**BrainstormInput:**
- [x] `brainstormInput.ts` exports singleton store
- [x] `BrainstormInputProvider.tsx` deleted
- [x] `BrainstormInputContext.tsx` deleted
- [x] No `<BrainstormInputProvider>` wrappers in component tree
- [x] Components subscribe directly with selectors
- [x] Upload works (jwt passed as parameter)
- [x] Textarea ref still accessible

**BrandPersonalization:**
- [x] `brandPersonalization.ts` exports singleton store
- [x] `BrandPersonalizationProvider.tsx` deleted
- [x] No `<BrandPersonalizationProvider>` wrappers in component tree
- [x] Components subscribe directly with selectors
- [x] Upload/theme actions work (jwt passed as parameter)

**General:**
- [x] All imports updated
- [x] App still works

## Technical Details

**Pattern to follow:** `stores/chatsRegistry.ts` - singleton Zustand store with direct subscriptions

**Consumers to update:**
- `BrainstormInput.tsx` - uses full state
- `BrainstormMessages.tsx` - uses `setInput`, `textareaRef` only

## Work Log

### 2025-12-30 - Created (Consolidated)
**By:** Claude Triage
**Actions:**
- Consolidated from issues #003, #004, #006, #014
- Elevated to P1 as architectural improvement
- #003: Delete re-export → absorbed (deleting provider entirely)
- #004: Lift provider → absorbed (deleting provider entirely)
- #006: Memoize context value → absorbed (deleting provider entirely)
- #014: Remove unused selectors → absorbed (selectors now used properly)
- Expanded scope to include BrandPersonalizationProvider (same anti-pattern)

**Learnings:**
- Zustand provides smart subscriptions via selectors out of the box
- Context wrapper unnecessary for singleton stores
- Provider pattern only needed for scoped/multiple store instances
- JWT should be passed as parameter to store actions, not injected via provider

### 2025-12-30 - Implemented
**By:** Claude
**Actions:**
- Converted `brainstormInput.ts` from factory (`createStore()`) to singleton (`create()`)
- Converted `brandPersonalization.ts` from factory to singleton
- Deleted `BrainstormInputProvider.tsx`, `BrainstormInputContext.tsx`, `BrandPersonalizationProvider.tsx`
- Updated `BrainstormInput.tsx`, `BrainstormMessages.tsx` to use singleton store with selectors
- Updated `BrainstormConversation.tsx`, `BrainstormLanding.tsx` to remove provider wrappers
- Updated `LogoUploadSection.tsx`, `ColorPaletteSection.tsx`, `ProjectImagesSection.tsx` to use singleton store
- Added module-level ref management (`setTextareaRef`, `getTextareaRef`) for textarea focus
- Updated test file to work with singleton store pattern
- JWT is now passed as parameter to upload actions (callers get from `usePage().props.jwt`)

**Implementation details:**
- `useBrainstormInputStore(selector)` - hook for subscriptions with selectors
- `brainstormInputStore` - raw store for direct access (e.g., in tests)
- `useBrandPersonalizationStore(selector)` - hook for brand personalization
- Export standalone API functions (`uploadLogo`, `uploadProjectImage`, etc.) that accept jwt parameter

## Resources

- Existing singleton pattern: `stores/chatsRegistry.ts`
- Zustand docs on selectors: https://docs.pmnd.rs/zustand/guides/auto-generating-selectors
