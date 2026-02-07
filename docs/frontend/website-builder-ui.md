# Website Builder Frontend

Two-panel layout: sidebar (chat + quick actions) on the left, live preview (iframe) on the right. The WebContainer provides an in-browser Node.js environment for real-time preview with Vite HMR.

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ Header (with progress stepper: brainstorm → website → …) │
├──────────────┬───────────────────────────────────────────┤
│   Sidebar    │              Preview Panel                │
│              │                                           │
│ ┌──────────┐ │  ┌───────────────────────────────────┐    │
│ │  Chat    │ │  │                                   │    │
│ │ Messages │ │  │    <iframe src={previewUrl} />     │    │
│ │          │ │  │                                   │    │
│ └──────────┘ │  │    (Vite dev server in            │    │
│ ┌──────────┐ │  │     WebContainer)                 │    │
│ │  Quick   │ │  │                                   │    │
│ │ Actions  │ │  └───────────────────────────────────┘    │
│ └──────────┘ │                                           │
│ ┌──────────┐ │                                           │
│ │  Chat    │ │                                           │
│ │  Input   │ │                                           │
│ └──────────┘ │                                           │
└──────────────┴───────────────────────────────────────────┘
```

The BuildStep renders the sidebar + preview side by side. DomainStep and DeployStep replace the preview with their own content.

## WebContainer Integration

### WebContainerManager

**File:** `rails_app/app/javascript/frontend/lib/webcontainer/manager.ts`

Singleton that manages the in-browser Node.js environment:

1. **Boot** — `WebContainer.boot({ workdirName: "project" })`
2. **Mount snapshot** — fetch pre-built binary with all node_modules
3. **Start Vite** — `npm run dev` spawned inside container, port detected
4. **Ready** — `previewUrl` available for iframe

Warmup starts eagerly at login (in SiteLayout), not when user navigates to the website builder.

### useWebsitePreview Hook

**File:** `rails_app/app/javascript/frontend/hooks/website/useWebsitePreview.ts`

Connects Langgraph file state to the WebContainer:

1. Reads files from `useWebsiteChatState("files")` (FileMap from Langgraph stream)
2. Converts FileMap → FileSystemTree via `convertFileMapToFileSystemTree()`
3. Calls `WebContainerManager.loadProject(fileTree)` to mount into container
4. Tracks previously mounted files via `mountedFilesRef` — skips re-mount if unchanged
5. Vite hot-reloads → iframe updates automatically

**Status states:** `idle → booting → mounting → installing → starting → ready`

### WebsitePreview Component

**File:** `rails_app/app/javascript/frontend/components/website/preview/WebsitePreview.tsx`

- Shows `WebsiteLoader` with progress steps while booting
- Renders `<iframe src={previewUrl} sandbox="allow-scripts allow-same-origin..." />` when ready
- Error retry on boot failure

## File Flow

```
Langgraph (AI edits)
       │ writes to website_files table
       ▼
syncFilesNode (reads code_files view)
       │ emits FileMap via SSE stream
       ▼
Frontend (useWebsiteChatState("files"))
       │ convertFileMapToFileSystemTree()
       ▼
WebContainerManager.loadProject(fileTree)
       │ instance.mount(files)
       ▼
Vite hot-reloads → iframe updates
```

**FileMap format** (from Langgraph state):
```typescript
{
  "/src/pages/IndexPage.tsx": {
    content: "import React from 'react'...",
    created_at: "2026-01-15T...",
    modified_at: "2026-01-15T..."
  }
}
```

## Quick Actions

**Directory:** `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/`

Quick action buttons in the sidebar accordion that trigger Langgraph intents without typing a chat message.

| Action | Component | What It Does |
|--------|-----------|-------------|
| Change Colors | `ChangeColors.tsx` | Opens theme selector, sends `change_theme` intent |
| Swap Images | `SwapImages.tsx` | Upload images, sends `swap_images` intent with batch |
| Improve Copy | `ImproveCopy.tsx` | Sends `improve_copy` intent to regenerate marketing text |

### Intent Pattern

Quick actions use `updateState()` to send an intent to Langgraph:

```typescript
const { updateState } = useChatActions();

// Change theme
updateState({ intent: { type: "change_theme", payload: { themeId } } });

// Swap images
updateState({ intent: { type: "swap_images", payload: { images } } });

// Improve copy
updateState({ intent: { type: "improve_copy" } });
```

The website graph routes by intent type:

| Intent | Handler | Description |
|--------|---------|-------------|
| `change_theme` | themeHandler | Silent CSS variable swap, no AI |
| `improve_copy` | improveCopy | Regenerate marketing copy |
| `swap_images` | websiteBuilder | Full agent with image context |
| default | websiteBuilder | Standard chat-driven edit |

## Sidebar Components

### WebsiteSidebar

**File:** `rails_app/app/javascript/frontend/components/website/sidebar/WebsiteSidebar.tsx`

Container for the sidebar with:
- Chat messages area (scrollable)
- Quick actions accordion (collapsible)
- Chat input at the bottom

### WebsiteChatMessages

Uses the Chat compound components with website-specific configuration:

```tsx
<Chat.Root chat={chat}>
  <Chat.Messages.List>
    {messages.map(msg => /* render messages */)}
    <Chat.Messages.StreamingIndicator />
    <Chat.Messages.ScrollAnchor />
  </Chat.Messages.List>
</Chat.Root>
```

### QuickActions

**File:** `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/QuickActions.tsx`

Accordion-style container with `QuickActionButton` components:

```tsx
<QuickActionButton
  label="Change Colors"
  icon={PaletteIcon}
  iconColor="text-purple-500"
  onClick={() => /* open theme selector */}
/>
```

## Website Page Steps

**File:** `rails_app/app/javascript/frontend/components/website/steps/index.tsx`

The Website page renders different steps based on the URL substep:

| Substep | Component | Content |
|---------|-----------|---------|
| `build` | `BuildStep` | Sidebar + preview (main builder) |
| `domain` | `DomainStep` | Domain picker, DNS verification |
| `deploy` | `DeployStep` | Deployment history, deploy button |

## Key Files Index

### WebContainer
| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/lib/webcontainer/manager.ts` | Singleton manager (boot, mount, Vite) |
| `rails_app/app/javascript/frontend/lib/webcontainer/file-utils.ts` | FileMap → FileSystemTree conversion |
| `rails_app/app/javascript/frontend/lib/webcontainer/types.ts` | Type definitions |
| `rails_app/app/javascript/frontend/hooks/website/useWebsitePreview.ts` | Files → container → preview URL |

### Preview
| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/components/website/preview/WebsitePreview.tsx` | Preview iframe + loader UI |

### Sidebar
| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/components/website/sidebar/WebsiteSidebar.tsx` | Sidebar container |
| `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/QuickActions.tsx` | Quick actions accordion |
| `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/QuickActionButton.tsx` | Reusable action button |
| `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/ChangeColors.tsx` | Theme selector action |
| `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/SwapImages.tsx` | Image upload action |
| `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/ImproveCopy.tsx` | Copy regeneration action |

### Steps
| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/components/website/steps/index.tsx` | Substep router |
| `rails_app/app/javascript/frontend/components/website/steps/BuildStep.tsx` | Main builder (sidebar + preview) |
| `rails_app/app/javascript/frontend/components/website/steps/DomainStep.tsx` | Domain selection |
| `rails_app/app/javascript/frontend/components/website/steps/DeployStep.tsx` | Deployment management |

### Chat Integration
| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/hooks/website/useWebsiteChat.ts` | Website chat hook |
| `rails_app/app/javascript/frontend/hooks/useChatOptions.ts` | Shared chat config factory |

## Related Docs

- [overview.md](./overview.md) — Frontend architecture and routing
- [streaming.md](./streaming.md) — How SSE streaming powers the chat
- [Website: WebContainers](../website/webcontainers.md) — Backend WebContainer system (snapshot, file flow)
- [Website: Coding Agent](../website/coding-agent.md) — How the AI generates/edits code
