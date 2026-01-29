# Projects Page - Planning Document

**Branch**: `project-page`
**Author**: Claude Code + ghock
**Reviewer**: Brett

## What We Built

A `/projects` index page that serves as the user's project dashboard. This initial implementation covers the **empty state** — what users see when they have a Launch10 account but haven't created any projects yet.

## Why

Previously, authenticated users were always routed directly to `projects#new` (the brainstorm/onboarding flow). There was no way to view a list of existing projects. The `/projects` page is the entry point for the dashboard experience.

## Design Reference

- Figma screenshot: `Desktop/Launch10/Design/Figma Designs/Dashboard - Projects Page/Projects Empty.png`
- The page uses the existing `SiteLayout` which provides the dark sidebar (AppSidebar) and header with logo/user menu.

## Files Changed

### Modified

| File                                     | Change                                                            |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `config/routes/subscribed.rb`            | Added `:index` to `resources :projects` `only:` array             |
| `app/controllers/projects_controller.rb` | Added `:index` to `set_project` except list; added `index` action |

### Created

| File                                         | Purpose                                        |
| -------------------------------------------- | ---------------------------------------------- |
| `app/javascript/frontend/pages/Projects.tsx` | New Inertia page component with empty state UI |
| `public/images/empty-folder.png`             | Streamline Milano empty folder illustration    |

## Design Decisions

1. **Layout**: Uses `layouts/webcontainer` (ERB) because it's the only layout that loads the Inertia/Vite entry point. `SiteLayout` (React) is auto-applied by `inertia.ts` and provides the sidebar + header.

2. **Props**: The controller passes `projects` (array of mini JSON) and `total_count`. The page conditionally renders empty state vs. project list based on `projects.length`.

3. **Subtitle visibility**: The "X total projects" subtitle is hidden when count is 0 (empty state), since showing "0 total projects" alongside "No projects yet" is redundant.

4. **Navigation**: The "+ Create Your First Project" button uses Inertia `Link` for client-side navigation to `/projects/new`. The existing `Button` component's default variant (dark background, white text) matches the Figma spec.

5. **No new stores/hooks**: This page doesn't need chat, workflow, or project context — it's a simple list view that reads props directly.

## How to Verify

1. Start the dev server: `cd rails_app && bin/dev`
2. Log in and visit `http://localhost:3000/projects`
3. Verify:
   - Page shows "Your Projects" heading
   - Empty state displays: folder illustration, "No projects yet", description text, CTA button
   - Clicking "+ Create Your First Project" navigates to `/projects/new`
   - Sidebar "Projects" (rocket icon) is highlighted
4. Run tests: `bundle exec rspec spec/requests/projects_spec.rb`

## Future Work

- Project cards grid (when projects exist)
- Project filtering/sorting
- Quick actions (resume, delete, duplicate)
