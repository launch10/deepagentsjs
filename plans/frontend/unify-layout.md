# Unify Sidebar + Main Content Layouts

## Context

Five pages use a sidebar + main content two-column grid, but each hardcodes its own grid classes. There are two distinct patterns that keep getting copy-pasted:

| Pattern | Grid | Gap | Padding | Pages |
|---------|------|-----|---------|-------|
| **Proportional** | `1fr 3fr` | `3%` | `2.5%` | BuildStep, DomainStep, Deploy |
| **Fixed** | `288px 1fr` | `2rem` | `2rem` | Brainstorm, Campaign |

Additionally, every sidebar card repeats the same shadow/border/rounding overrides:
```
shadow-[0px_0px_8px_4px_rgba(167,165,161,0.08)] bg-background border-neutral-300 rounded-2xl py-0 gap-0
```

The PaginationFooter's `FullBleedLayout` also hardcodes `grid-cols-[1fr_3fr] gap-x-[3%] px-[2.5%]` to keep its border line aligned with the content column.

## Goals

- **Up consistency** — all sidebar pages should feel like the same app
- **Responsive by default** — all variants collapse to single-column on mobile
- **Opacity transitions everywhere** — smooth content appearance on all pages (currently only Brainstorm does this)
- **Fix latent bugs** — DomainStep sidebar is missing `min-h-0 overflow-hidden`

## Approach

Create two small, focused abstractions:

### 1. `SidebarLayout` — Compound component for the grid shell

**Location:** `app/javascript/frontend/components/shared/sidebar-layout/`

```
SidebarLayout.tsx          — Root, Content, Sidebar, Main
SidebarLayoutContext.tsx    — Context + variant config + hooks
SidebarCard.tsx             — Card wrapper with sidebar styling
index.ts                    — Barrel exports
```

**API:**

```tsx
<SidebarLayout.Root variant="proportional">
  <SidebarLayout.Content verticalPadding="top-only">
    <SidebarLayout.Sidebar>
      <WebsiteSidebar />
    </SidebarLayout.Sidebar>
    <SidebarLayout.Main className="-mb-20 overflow-hidden">
      <WebsitePreview />
    </SidebarLayout.Main>
  </SidebarLayout.Content>

  <PaginationFooter.Root layout="full-bleed" ...>
    ...
  </PaginationFooter.Root>
</SidebarLayout.Root>
```

**Component responsibilities:**

- `Root` — Provides layout config context via variant. Renders a wrapper `<div className="h-full flex flex-col">`. Includes a built-in opacity transition (`transition-opacity duration-300 ease-out`) controlled by a `visible` prop (defaults to `true`). Page passes `className` for any additional styling.
- `Content` — The `<main>` grid. Reads variant from context to apply correct `grid-cols`, `gap`, `px`, `py`. Props: `verticalPadding` (`"all"` | `"top-only"` | `"none"`), `container` (adds `mx-auto container max-w-7xl` for fixed variant)
- `Sidebar` — Left column wrapper. Applies `min-h-0 overflow-hidden` by default. Optional `sticky` prop adds `sticky top-24`. Optional `responsive` prop (default `true`) adds `hidden lg:block` to hide sidebar on mobile.
- `Main` — Right column wrapper. Just `min-h-0` + caller's `className` for page-specific styling

**Variant config (centralized, responsive by default):**
```ts
proportional: {
  gridCols: "grid-cols-1 lg:grid-cols-[1fr_3fr]",
  gap: "gap-x-[3%]",
  padding: "px-[2.5%]"
}
fixed: {
  gridCols: "grid-cols-1 lg:grid-cols-[288px_1fr]",
  gap: "gap-8",
  padding: "px-8"
}
```

Both variants collapse to `grid-cols-1` below `lg`, matching the pattern Brainstorm already uses. This brings responsive behavior to BuildStep, DomainStep, Deploy, and Campaign for free.

### 2. `SidebarCard` — Card variant with shared sidebar styling

Wraps the existing `Card` component with the repeated overrides:

```tsx
export function SidebarCard({ className, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "shadow-[0px_0px_8px_4px_rgba(167,165,161,0.08)]",
        "bg-background border-neutral-300 rounded-2xl",
        "py-0 gap-0",
        className,
      )}
      {...props}
    />
  );
}
```

### 3. PaginationFooter alignment

Update `FullBleedLayout` in `pagination-footer/Root.tsx` to read grid config from `SidebarLayout` context (via `useSidebarLayoutConfigOptional`), falling back to current hardcoded values when used outside a `SidebarLayout`.

## Files to create

- `app/javascript/frontend/components/shared/sidebar-layout/SidebarLayoutContext.tsx`
- `app/javascript/frontend/components/shared/sidebar-layout/SidebarLayout.tsx`
- `app/javascript/frontend/components/shared/sidebar-layout/SidebarCard.tsx`
- `app/javascript/frontend/components/shared/sidebar-layout/index.ts`

## Files to modify

### Page migrations (replace hardcoded grid with SidebarLayout)

1. **`app/javascript/frontend/components/website/steps/BuildStep.tsx`** — Replace `div.h-full > main.grid` with `SidebarLayout.Root variant="proportional"` + `Content verticalPadding="top-only"`. Sidebar gets default responsive behavior.

2. **`app/javascript/frontend/components/website/steps/DomainStep.tsx`** — Same pattern as BuildStep. Sidebar gains `min-h-0 overflow-hidden` it was previously missing (bug fix).

3. **`app/javascript/frontend/pages/Deploy.tsx`** — `SidebarLayout.Root variant="proportional"` + `Content verticalPadding="all"`

4. **`app/javascript/frontend/components/brainstorm/conversation-page/BrainstormConversationPage.tsx`** — `SidebarLayout.Root variant="fixed" visible={contentVisible}` + `Content container`. Sidebar gets `sticky className="pt-[46px]"`. The opacity transition moves from a manual div to Root's built-in `visible` prop.

5. **`app/javascript/frontend/pages/Campaign.tsx`** — `SidebarLayout.Root variant="fixed"` + `Content container`

### Sidebar card migrations (replace repeated Card overrides with SidebarCard)

6. **`app/javascript/frontend/components/website/sidebar/WebsiteSidebar.tsx`** — `Card className="shadow-[...] ..."` → `SidebarCard`
7. **`app/javascript/frontend/components/deploy/DeploySidebar.tsx`** — Same
8. **`app/javascript/frontend/components/ads/WorkflowPanel.tsx`** — Same
9. **`app/javascript/frontend/components/brainstorm/conversation-page/brand-panel/BrandPersonalizationPanel.tsx`** — Replace raw `<div>` with `<SidebarCard className="px-3 py-4 w-[288px]">`

### Footer alignment

10. **`app/javascript/frontend/components/shared/pagination-footer/Root.tsx`** — `FullBleedLayout` reads `useSidebarLayoutConfigOptional()` for grid classes, falls back to current hardcoded values

## Intentional behavior changes

These are changes we're making deliberately for consistency:

- **Opacity transition on all pages** — Root includes `transition-opacity duration-300 ease-out` by default. Currently only Brainstorm does this. Adds a polished feel to all sidebar pages.
- **Responsive grid on all pages** — Both variants use `grid-cols-1 lg:grid-cols-[...]`. Currently only Brainstorm is responsive. Brings mobile support to BuildStep, DomainStep, Deploy, Campaign.
- **DomainStep sidebar overflow fix** — Sidebar wrapper gains `min-h-0 overflow-hidden` to match BuildStep. Was missing before (likely a bug from copy-paste).
- **Sidebar hidden on mobile by default** — `Sidebar` adds `hidden lg:block` by default. Pages that need the sidebar visible on mobile can pass `responsive={false}`.

## What stays the same

- Footer is NOT a slot in the layout — remains a sibling inside `Root`, just reads context for alignment
- Each page's content area styling (borders, overflow, negative margins) stays as `className` on `SidebarLayout.Main`
- Sidebar content (WebsiteSidebar, DeploySidebar, etc.) is unchanged — only the wrapping Card/div changes
- `ContainerLayout` in PaginationFooter is unchanged (no grid alignment needed)
- Header component alignment stays hardcoded (renders outside page content, only uses fixed variant)

## Verification

1. Visually verify all 5 pages render identically before/after on desktop:
   - `/projects/{uuid}/website/build` — BuildStep
   - `/projects/{uuid}/website/domain` — DomainStep
   - `/projects/{uuid}/deploy` — Deploy
   - `/projects/{uuid}/brainstorm` — Brainstorm
   - `/projects/{uuid}/ads` — Campaign
2. Verify PaginationFooter border line still aligns with content column on BuildStep/DomainStep/Deploy
3. Verify sticky sidebar behavior on Brainstorm and Campaign pages
4. Verify responsive behavior: sidebar hides on mobile across all pages
5. Verify opacity transition: pages fade in smoothly on load
6. Run `pnpm typecheck` to confirm no type errors
