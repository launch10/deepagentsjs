# Plan: Theme Integration for Coding Agent (Simplified)

## Problem

The coding agent needs theme colors applied to `src/index.css`. That's it.

## Current State

- `buildContext` already loads theme into state (including full CSS vars)
- Template's `index.css` has hardcoded default colors
- `IndexCssService` exists in TODO folder - replaces `:root` CSS vars
- Agent has filesystem access and can modify any file

## Solution (2 Steps)

### Step 1: Move IndexCssService to Active

Move **only** `IndexCssService.ts` from `langgraph_app/TODO/services/websites/themes/` to `langgraph_app/app/services/themes/`.

Fix the dependency issue: It uses `TemplateFileModel.findBy()` which doesn't exist. Replace with direct DB query or `WebsiteFilesAPIService`.

### Step 2: Apply Theme in buildContext

Add ~15 lines to `buildContext.ts` after loading theme:

```typescript
// In buildContext.ts, after theme is loaded:
if (theme?.theme) {
  const indexCssService = new IndexCssService();
  const themedCss = await indexCssService.execute({
    websiteId: state.websiteId,
    filePath: 'src/index.css',
    theme,
  });

  // Write to website files via existing API
  await new WebsiteFilesAPIService().write(state.websiteId, state.jwt, [
    { path: 'src/index.css', content: themedCss }
  ]);
}
```

**That's it.** No new nodes. No new annotations. No graph changes.

---

## Why This Works

1. **Each Langgraph invocation loads theme fresh** - `buildContext` runs every time
2. **User changes theme via UI** → Next message triggers new invocation → `buildContext` loads new theme → CSS updated
3. **Agent can still modify** - It has filesystem access to `index.css`
4. **No change detection needed** - We just apply current theme every time

---

## Community Theme Expansion (Separate Concern)

When user creates community theme with 6 hex colors, expand to full CSS vars.

**Where:** Rails `Theme` model

```ruby
# app/models/theme.rb
class Theme < ApplicationRecord
  before_save :expand_colors_to_theme, if: :colors_changed?

  private

  def expand_colors_to_theme
    return if colors.blank?
    self.theme = ThemeExpanderService.new(colors).call
  end
end
```

Port the color expansion logic to a simple Ruby service (~50 lines). This is independent of the agent work.

---

## Files to Modify

| File | Change |
|------|--------|
| `langgraph_app/app/services/themes/indexCssService.ts` | Move from TODO, fix dependencies |
| `langgraph_app/app/nodes/codingAgent/buildContext.ts` | Add ~15 lines to apply theme |
| `rails_app/app/models/theme.rb` | Add `before_save` callback (optional, for community themes) |
| `rails_app/app/services/theme_expander_service.rb` | New ~50 line Ruby service (optional) |

---

## What We're NOT Doing

- ❌ No `themeChange` annotation
- ❌ No `handleThemeChange` node
- ❌ No graph flow changes
- ❌ No "refresh pattern" copying
- ❌ No system prompt updates (agent can read the CSS file)
- ❌ No moving 10 services from TODO (just 1)

---

## Edge Cases

**Legacy community themes without `theme` field:**
- Fallback: expand on first use in `buildContext`, save back to DB
- Or: migration to backfill existing themes

**IndexCssService fails:**
- Log error, continue without theme (graceful degradation)
- Agent sees default colors, can still build the page

**Agent modifies index.css, then user changes theme:**
- Next invocation overwrites with new theme
- This is correct behavior - user explicitly changed theme
