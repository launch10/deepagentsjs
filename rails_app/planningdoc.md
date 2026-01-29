# Projects Page - Planning Document

**Branch**: `project-page`
**Author**: Claude Code + ghock
**Reviewer**: Brett

## What We Built

A `/projects` index page that serves as the user's project dashboard. This covers:

1. **Empty state** — when a user has no projects (folder illustration, CTA button)
2. **Populated state** — project card list with status tags, segmented filter, domain links, action buttons

## Why

Previously, authenticated users were always routed directly to `projects#new` (the brainstorm/onboarding flow). There was no way to view a list of existing projects. The `/projects` page is the entry point for the dashboard experience.

## Design Reference

- Figma: `Dashboard - Projects Page/Projects Empty.png` (empty state)
- Figma: `Dashboard - Projects Page/Projects Collapsed.png` (populated state)
- The page uses the existing `SiteLayout` which provides the dark sidebar (AppSidebar) and header with logo/user menu.

## Files Changed

### Modified

| File | Change |
| --- | --- |
| `config/routes/subscribed.rb` | Added `:index` to `resources :projects` `only:` array |
| `app/controllers/projects_controller.rb` | Added `:index` to `set_project` except list; added `index` action with eager loading |
| `app/models/concerns/project_concerns/serialization.rb` | Added `derived_status` method; extended `to_mini_json` with `status` and `domain` |
| `spec/support/schemas/inertia/leads_schema.rb` | Updated `project_mini_schema` with `status` and `domain` fields |
| `lib/tasks/inertia.rake` | Registered `ProjectsProps` schema and `/projects` page route |
| `spec/requests/inertia/projects_spec.rb` | Added index page tests (empty + populated, schema validation) |

### Created

| File | Purpose |
| --- | --- |
| `app/javascript/frontend/pages/Projects.tsx` | Inertia page: empty state + populated state with filter + card list |
| `app/javascript/frontend/components/projects/ProjectCard.tsx` | Project row card: thumbnail placeholder, status tag, domain link, timestamps, action buttons |
| `spec/support/schemas/inertia/projects_schema.rb` | RSwag schema defining `ProjectsProps` for type generation |
| `public/images/empty-folder.png` | Streamline Milano empty folder illustration |

### Generated (auto-generated, do not manually edit)

| File | Purpose |
| --- | --- |
| `swagger/v1/inertia-props.yaml` | OpenAPI spec with `/projects` path + `ProjectsProps` schema |
| `shared/lib/api/generated/inertia-props.ts` | TypeScript types generated from OpenAPI spec |

## Design Decisions

1. **Layout**: Uses `layouts/webcontainer` (ERB) because it's the only layout that loads the Inertia/Vite entry point. `SiteLayout` (React) is auto-applied by `inertia.ts` and provides the sidebar + header.

2. **Props**: The controller passes `projects` (array of mini JSON with status + domain) and `total_count`. The page conditionally renders empty state vs. populated state based on `projects.length`.

3. **Derived status**: No explicit status field on Project. Status is derived at serialization time:
   - `"live"` — any deploy with `is_live: true`
   - `"paused"` — any campaign with `status: "paused"`
   - `"draft"` — everything else
   The `derived_status` method uses `.loaded?` guards to check in-memory when associations are preloaded (via `.includes`), falling back to DB queries otherwise.

4. **N+1 prevention**: Controller uses `.includes({ website: :domains }, :deploys, :campaigns)` — 5 queries total regardless of project count.

5. **Client-side filtering**: Segmented control (All/Live/Paused/Draft) filters projects in-memory with `useMemo`. No server round-trips for filter changes. Counts computed from the full projects array.

6. **Type generation**: Uses the RSwag/InertiaProps pipeline — Ruby schema → OpenAPI YAML → TypeScript types. Frontend imports `ProjectsPageProps` from `@shared` via the generated types.

7. **Single-column list**: Cards are full-width rows (not a multi-column grid), matching the Figma "collapsed sidebar" design.

8. **Action button states**: Live projects get enabled "Customer Leads" button (links to `/projects/{uuid}/leads`). Paused/draft projects get disabled buttons with explicit muted colors (not opacity). Performance button is always disabled (no route exists yet).

9. **Thumbnail placeholder**: 180px wide area with `PhotoIcon` centered on `#F8F8F8` background. Real thumbnails deferred to a separate thumbnail generation feature.

## How to Verify

1. Start the dev server: `cd rails_app && bin/dev`
2. Log in and visit `http://localhost:3000/projects`
3. Verify empty state:
   - "Your Projects" heading, folder illustration, "No projects yet", CTA button
   - Clicking "+ Create Your First Project" navigates to `/projects/new`
4. Create a project, then revisit `/projects`:
   - Card appears with "Draft" tag, "No site connected", disabled buttons, photo placeholder
   - "+ New Project" button visible in top-right
   - "1 total project" subtitle shows
5. Test segmented filter: counts update, filtering works
6. Run tests: `bundle exec rspec spec/requests/inertia/projects_spec.rb`
7. Generate types: `bundle exec rake rswag:specs:swaggerize`

## Deferred to Next Commit

- Three-dot menu (ellipsis-vertical icon per card)
- Real landing page thumbnails (needs thumbnail generation service)
- Performance route/page
- Card click-to-navigate
