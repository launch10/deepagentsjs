# UI Design System & Component Patterns

shadcn/ui + Radix primitives + Tailwind CSS v4. Components use CVA (class-variance-authority) for variant management and `cn()` for class merging.

## Core Utilities

**`cn()` helper** — `rails_app/app/javascript/frontend/lib/utils.ts`

Combines `clsx` (conditional classes) + `tailwind-merge` (deduplication):
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**CVA pattern** — defines variant-based component styles:
```typescript
const buttonVariants = cva("inline-flex items-center rounded-md...", {
  variants: {
    variant: { default: "bg-primary...", outline: "border..." },
    size: { default: "h-9 px-4", sm: "h-8 px-3", lg: "h-10 px-6" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
```

## UI Primitives

**Directory:** `rails_app/app/javascript/frontend/components/ui/`

35+ reusable components built on Radix UI primitives:

| Component | File | Built On |
|-----------|------|----------|
| Button | `button.tsx` | CVA variants |
| Input | `input.tsx` | Native input |
| Textarea | `textarea.tsx` | Native textarea |
| Dialog | `dialog.tsx` | `@radix-ui/react-dialog` |
| Dropdown Menu | `dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` |
| Select | `select.tsx` | `@radix-ui/react-select` |
| Tabs | `tabs.tsx` | `@radix-ui/react-tabs` |
| Tooltip | `tooltip.tsx` | `@radix-ui/react-tooltip` |
| Popover | `popover.tsx` | `@radix-ui/react-popover` |
| Switch | `switch.tsx` | `@radix-ui/react-switch` |
| Toggle / ToggleGroup | `toggle.tsx`, `toggle-group.tsx` | `@radix-ui/react-toggle` |
| Progress | `progress.tsx` | `@radix-ui/react-progress` |
| Separator | `separator.tsx` | `@radix-ui/react-separator` |
| Label | `label.tsx` | `@radix-ui/react-label` |
| Card | `card.tsx` | Styled div |
| Badge | `badge.tsx` | CVA variants |
| Alert | `alert.tsx` | CVA variants |
| Accordion | `accordion.tsx` | Radix Accordion |
| Avatar | `avatar.tsx` | Styled div |
| Sidebar | `sidebar.tsx` | Custom compound |
| InputGroup | `input-group.tsx` | CVA + compound (InputGroupAddon, InputGroupButton) |
| Spinner | `spinner.tsx` | CSS animation |
| LogoSpinner | `logo-spinner.tsx` | Animated logo |
| TextShimmer | `text-shimmer.tsx` | CSS gradient animation |

## Field Compound Component

**File:** `rails_app/app/javascript/frontend/components/ui/field.tsx`

Compound component for consistent form field layout:

```tsx
<Field>
  <FieldLabel>Email</FieldLabel>
  <FieldContent>
    <Input {...register("email")} />
  </FieldContent>
  <FieldDescription>Your work email address</FieldDescription>
  <FieldError>{errors.email?.message}</FieldError>
</Field>
```

Sub-components: `Field`, `FieldLabel`, `FieldContent`, `FieldDescription`, `FieldError`, `FieldSet`, `FieldCheckbox`.

## Feature-Organized Components

Components outside `ui/` are organized by feature domain:

### Navigation
**Directory:** `rails_app/app/javascript/frontend/components/navigation/`
- `AppSidebar.tsx` — Left sidebar with project list, nav links, credit display
- `AdminSidebar.tsx` — Admin-only sidebar variant
- `NewProjectButton.tsx` — Starts a new project

### Shared Components
**Directory:** `rails_app/app/javascript/frontend/components/shared/`

| Subdirectory | Components | Purpose |
|--------------|------------|---------|
| `chat/` | Chat compound (Root, Messages, Input, BlockRenderer, etc.) | Reusable chat UI system |
| `header/` | Header, AdminHeader, HeaderProgressStepper, HeaderUser | Top navigation bar |
| `pagination-footer/` | PaginationFooter compound (Root, BackButton, ContinueButton, Actions) | Step navigation |
| `forms/` | InputAddable, InputLockable | Specialized form inputs |

### Brainstorm
**Directory:** `rails_app/app/javascript/frontend/components/brainstorm/`
- `landing-page/` — BrainstormLandingPage, ExampleAnswers
- `conversation-page/chat/` — BrainstormMessages, BrainstormAIMessage, QuestionBadge
- `conversation-page/brand-panel/` — BrandPersonalizationPanel (logo upload, colors, social links, images)

### Website Builder
**Directory:** `rails_app/app/javascript/frontend/components/website/`
- `steps/` — BuildStep, DomainStep, DeployStep
- `sidebar/` — WebsiteSidebar, WebsiteChat, QuickActions
- `preview/` — WebsitePreview (iframe), WebsiteLoader
- `domain-picker/` — DomainPicker, SiteNameDropdown, DnsHelpSection

### Ads
**Directory:** `rails_app/app/javascript/frontend/components/ads/`
- `forms/` — Content, highlights, keywords, settings, launch forms
- `workflow-panel/` — WorkflowBuddy (ads chat + workflow), AdPreview
- `hooks/` — useAdsChatState, useAutosaveCampaign

## Toast System

**Library:** Sonner (`sonner` package)

Configured in SiteLayout:
```tsx
<Toaster position="top-right" />
```

Flash messages from Rails are displayed as toasts on page load. Custom icons per type (success, error, info).

## Dialog / Modal Pattern

Radix Dialog with portal rendering and animation:
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* content */}
  </DialogContent>
</Dialog>
```

Renders via portal to avoid z-index issues. Auto-closes on overlay click or Escape key.

## Loading Patterns

| Component | File | Behavior |
|-----------|------|----------|
| `Spinner` | `ui/spinner.tsx` | CSS animated spinner |
| `LogoSpinner` | `ui/logo-spinner.tsx` | Animated Launch10 logo |
| `TextShimmer` | `ui/text-shimmer.tsx` | Gradient animation on text |
| `BrainstormChatSkeleton` | `brainstorm/.../BrainstormChatSkeleton.tsx` | Placeholder skeleton while loading |

Loading states use `useMinimumDuration` hook to prevent flash of loading content (200ms minimum display).

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/lib/utils.ts` | `cn()` utility (clsx + tailwind-merge) |
| `rails_app/app/javascript/frontend/components/ui/button.tsx` | Button with CVA variants |
| `rails_app/app/javascript/frontend/components/ui/field.tsx` | Field compound component for form layout |
| `rails_app/app/javascript/frontend/components/ui/input-group.tsx` | InputGroup compound with CVA |
| `rails_app/app/javascript/frontend/components/ui/dialog.tsx` | Radix Dialog wrapper |
| `rails_app/app/javascript/frontend/components/ui/sidebar.tsx` | Sidebar compound component |
| `rails_app/app/javascript/frontend/components/navigation/AppSidebar.tsx` | Main app sidebar |
| `rails_app/app/javascript/frontend/components/shared/chat/Chat.tsx` | Chat compound component exports |
| `rails_app/app/javascript/frontend/components/shared/pagination-footer/compound.tsx` | Pagination footer compound |

## Related Docs

- [overview.md](./overview.md) — Frontend architecture and directory structure
- [streaming.md](./streaming.md) — Chat compound component details
- [forms-and-state.md](./forms-and-state.md) — Form patterns and validation
