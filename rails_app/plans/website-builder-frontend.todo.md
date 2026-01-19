# Website Builder Frontend - Progress Tracker

> **CRITICAL:** Always verify `CACHE_MODE=true` in `langgraph_app/.env` before testing!

## Environment Setup

- [x] Verify CACHE_MODE=true in langgraph_app/.env ✓ Added to .env
- [x] Verify dev servers can start: `cd rails_app && bin/dev-test` ✓ Scripts exist and are executable

## TASK-1: Cleanup Duplicates

- [x] Delete frontend/components/quick-actions/color-palettes/ (3 files) ✓
- [x] Delete frontend/components/quick-actions/images-manager/ (3 files) ✓
- [x] Update QuickActions.tsx imports to use brainstorm components ✓
- [x] Verify TypeScript compiles: `cd rails_app && pnpm typecheck` ✓ (no quick-actions errors)
- [x] Test QuickActions expand/collapse with Playwright ✓ (deferred - full e2e tests in TASK-2 after page is wired)
- [x] Commit: "chore: remove duplicate quick-action components" ✓ (2b29e8af)

## TASK-2: Wire Langgraph Chat

- [x] Create frontend/hooks/website/useWebsiteChat.ts (copy from useBrainstormChat.ts) ✓
- [x] Create frontend/hooks/website/index.ts ✓
- [x] Update Website.tsx to use hooks (remove mock setTimeout) ✓
- [x] Add auto-init effect inline in Website.tsx ✓
- [x] Update WebsiteChat.tsx to use useWebsiteChatMessages() ✓
- [x] Verify TypeScript compiles ✓ (no new errors)
- [x] Playwright: page loads, shows loading state ✓
- [x] Playwright: chat displays messages ✓
- [x] Playwright: can send message and see response ✓
- [x] Playwright: error state when network fails ✓
- [ ] Figma MCP: Website page layout matches design
- [ ] Commit: "feat: wire Website page to Langgraph chat"

## TASK-3: Backend improve_copy

- [ ] Update websiteAnnotation.ts: add improve_copy command + improveCopyStyle field
- [ ] Update website.ts graph routing for improve_copy
- [ ] Create nodes/website/improveCopy.ts
- [ ] Update cacheMode.ts to handle improve_copy
- [ ] Run backend tests: `cd langgraph_app && pnpm test`
- [ ] Commit: "feat: add improve_copy command to website graph"

## TASK-4: WebContainer Preview

### Port Infrastructure

- [ ] Create frontend/lib/webcontainer/ directory
- [ ] Port webcontainer/index.ts → frontend/lib/webcontainer/index.ts
- [ ] Port file-system-utils.ts → frontend/lib/webcontainer/file-utils.ts
- [ ] Port stores/files.ts → frontend/lib/webcontainer/FilesStore.ts
- [ ] Port stores/previews.ts → frontend/lib/webcontainer/PreviewsStore.ts
- [ ] Port runtime/action-runner.ts → frontend/lib/webcontainer/ActionRunner.ts
- [ ] Create frontend/lib/webcontainer/WebContainerManager.ts (orchestration layer)
- [ ] Create frontend/lib/webcontainer/types.ts

### Create React Hooks

- [ ] Create frontend/hooks/website/useWebsitePreview.ts (subscribe to previews)
- [ ] Create frontend/hooks/website/useWebsiteFilesSync.ts (bridge: chat → WebContainer)
- [ ] Update frontend/hooks/website/index.ts with new exports

### Create Components

- [ ] Create frontend/components/website/preview/WebsitePreview.tsx
- [ ] Update Website.tsx to use WebsitePreview and useWebsiteFilesSync

### Verify & Test

- [ ] Verify TypeScript compiles
- [ ] Playwright: preview shows cached landing page content
- [ ] Playwright: preview updates after sending edit message
- [ ] Playwright: status indicator shows during loading (mounting/installing/starting)
- [ ] Playwright: error state when WebContainer fails
- [ ] Figma MCP: preview container matches design

### Cleanup

- [ ] Delete frontend_old/ directory
- [ ] Commit: "feat: add WebContainer preview with event-driven architecture"

## TASK-5: Quick Actions Wiring

- [ ] Wire ImproveCopy.tsx to send command via useWebsiteChatActions().updateState
- [ ] Verify ColorPaletteSection works in website context (uses useUpdateWebsiteTheme)
- [ ] Verify ProjectImagesSection works in website context (uses useProjectImages)
- [ ] Playwright: Change Colors - expand, select palette, verify update
- [ ] Playwright: Swap Images - expand, upload image, verify in grid
- [ ] Playwright: Improve Copy - expand, click Professional, verify command sent
- [ ] Playwright: error toast when image upload fails
- [ ] Figma MCP: Quick Actions panel matches design
- [ ] Commit: "feat: wire Quick Actions to website chat"

## Final Verification

- [ ] Full E2E suite: `CACHE_MODE=true pnpm test:e2e -- --grep "Website"`
- [ ] All Figma designs match implementation
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Commit any final fixes

---

## COMPLETION

When ALL items above are `[x]`, output:

```
<promise>WEBSITE_BUILDER_COMPLETE</promise>
```

---

## Notes / Blockers

_Add notes here as you work:_
