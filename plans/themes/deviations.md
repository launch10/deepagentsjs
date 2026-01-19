# Theme System: Deviations & Recommendations

## Summary

The theme system is **working correctly** for its core purpose. However, there's significant drift between what exists in the codebase and what's actually used.

---

## Current State vs Intended Design

### What's Working As Designed

| Component                 | Status     | Notes                                             |
| ------------------------- | ---------- | ------------------------------------------------- |
| SemanticVariables concern | ✅ Fixed   | Background derivation now works (commit 867cc2e8) |
| Theme CSS injection       | ✅ Working | Injects :root block into index.css                |
| themeColorsPrompt         | ✅ Active  | Teaches AI semantic color roles                   |
| typographyPrompt          | ✅ Active  | Provides per-background text guidance             |

### What Has Drifted

#### 1. ~~Massive Prompt Library Unused~~ (RESOLVED)

12 unused design prompt files were deleted. The active prompts are now:

- themeColorsPrompt
- typographyPrompt
- fontAndResponsivePrompt
- designChecklistPrompt

---

#### 2. ThemeLabels System - Future Use Planned

**Location**:

- `rails_app/app/models/theme_label.rb`
- `rails_app/app/models/theme_to_theme_label.rb`

**Current State**: Labels exist (seeded in `themes.sql`), are returned by the API, but not yet used for selection logic.

**Planned Use**: Automatic theme selection when users don't pick their own.

Today, when a user skips theme selection, we just pick the FIRST theme. This will get boring fast - every auto-assigned website looks the same.

**Future behavior**:

```ruby
# Instead of: Theme.first
# We want: Theme.with_label("vibrant").sample or similar
```

Labels like "vibrant", "minimal", "bold", "professional" will let us:

1. Vary automatic selections (not always the same theme)
2. Match theme mood to brainstorm tone (energetic idea → vibrant theme)
3. Eventually let users filter by style preference

**Status**: Keep. Will be used for smarter auto-selection.

---

#### 3. User::Theme vs Website Themes Confusion

**Location**: `rails_app/app/models/user/theme.rb`

**Issue**: Two completely different "theme" concepts:

- `User#theme` - App UI preference (light/dark/system)
- `Website#theme_id` - Landing page color scheme

**No actual confusion in code** - they're separate concerns. But naming overlap may confuse developers.

**Recommendation**: **Keep as-is**. The naming is standard (app theme preference vs website styling). Document clearly.

---

#### 4. Pairings Column - Internal Only

**Location**: `themes.pairings` JSONB column

**Issue**: This column stores raw contrast ratios between all color pairs. It's only used internally to compute `typography_recommendations`.

**Question**: Should we expose pairings to the UI for a "color pairing helper"?

**Current state**: Not exposed anywhere user-facing. Just an intermediate computation.

**Recommendation**: **Keep as-is**. It's a reasonable intermediate data structure. No action needed.

---

#### 5. Typography Recommendations - High Effort, Low Visibility

**Location**:

- `ThemeConcerns::TypographyRecommendations` (247 lines)
- `typography.ts` prompt (95 lines)

**Issue**: Complex system to compute which text colors work on which backgrounds. But:

- The prompt output is relatively simple
- The AI already knows WCAG contrast rules
- May be over-engineering

**Sample output**:

```
On #264653 background:
  Headlines: #E9C46A (8.2:1 AAA) [palette color]
  Body: #FAFAFA (12.5:1 AAA) [standard]
```

**Recommendation**: **Monitor effectiveness**. If generated pages have text contrast issues, this is valuable. If not, could simplify.

---

## Recommendations Summary

### Keep As-Is

| Component           | Reason                                                     |
| ------------------- | ---------------------------------------------------------- |
| SemanticVariables   | Core algorithm, working well                               |
| Theme CSS injection | Simple, effective                                          |
| themeColorsPrompt   | Essential for AI guidance                                  |
| typographyPrompt    | Valuable accessibility guidance                            |
| pairings column     | Useful intermediate data                                   |
| User::Theme concern | Separate valid concern                                     |
| ThemeLabels         | Needed for smarter auto-selection (not always first theme) |
