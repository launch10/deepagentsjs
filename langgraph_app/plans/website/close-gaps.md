# Website Builder Quick Actions — Close Gaps Plan

## Summary

The Quick Actions (Change Colors, Swap Images, Improve Copy) are ~85% done. This plan closes the remaining gaps with minimal changes:

1. Fix padding on settings panels
2. Add "Apply" button for Swap Images (uses default intent, not a new subgraph)
3. Fix classifier to route image context to full agent
4. Add minimal E2E tests using `website_generated` snapshot

Key simplification: **No new `swapImages` intent or node.** The default `websiteBuilderSubgraph` already calls `injectAgentContext()` which fetches `images.created`/`images.deleted` events. We just need to send a chat message ("Update the page with my uploaded images") and the existing pipeline handles it. The classifier fix ensures it routes to the full agent when image context is present.

---

## Step 1: Fix QuickActions Panel Padding

**File**: `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/QuickActions.tsx`

The settings panels (colors, images, copy) render right after a `<Separator>` with no padding, while `CardHeader` above has `px-5 py-5`. The `ImproveCopy` component has its own `CardContent` with `px-4 py-4` — the images and colors panels don't.

**Change**: Wrap `{settingsContent}` in `<div className="px-5 py-4">` inside the `motion.div`, after the `<Separator>`:

```tsx
<Separator className="bg-neutral-300" />
<div className="px-5 py-4">
  {settingsContent}
</div>
```

This gives all three panels consistent horizontal padding matching the CardHeader.

---

## Step 2: Add "Update Page with Images" Button to Swap Images Panel

**File**: `rails_app/app/javascript/frontend/components/website/sidebar/quick-actions/QuickActions.tsx`

When images exist, show a button below `<ProjectImagesSection />` that sends a chat message to trigger the agent.

**Approach**: Instead of creating a new intent type, we send a regular chat message via `sendMessage()`. The default `websiteBuilderSubgraph` will:

1. Call `injectAgentContext()` which fetches `images.created`/`images.deleted` events
2. Prepend those as context messages
3. The coding agent sees both the user's request AND the image context

**Changes**:

- Import `useWebsiteChatIsStreaming` and `useProjectImages` from existing hooks
- In the `case "images"` block, render `<ProjectImagesSection />` followed by a Button
- Button text: "Update Page with Images"
- On click: call `sendMessage("Update the landing page to use the images I uploaded. Replace placeholder or stock images with my uploaded ones.")` from `useWebsiteChatActions()`
- Disable while streaming
- Only show when `useProjectImages()` returns data (images exist)

```tsx
case "images":
  return (
    <>
      <ProjectImagesSection />
      {hasImages && (
        <Button onClick={handleApplyImages} disabled={isStreaming}>
          Update Page with Images
        </Button>
      )}
    </>
  );
```

---

## Step 3: Fix Classifier to Route Image Context to Full Agent

**File**: `langgraph_app/app/nodes/coding/agent.ts` — `resolveRoute()` function

When `injectAgentContext` prepends image events to the messages, the classifier doesn't know about them because it only reads `userText` from the last message. The classifier call in `resolveRoute()` happens before the full context is built (in `websiteBuilderNode`), so images will always be missed.

However, `resolveRoute()` sees `options.messages` which at this point are the raw state messages. It won't have image context injected yet. The fix should be simpler:

**Approach**: Scan `options.messages` for multimodal content (image_url blocks from `createMultimodalContextMessage`) that `injectAgentContext` may have added in a prior turn. Also, check the user text for image-related keywords that suggest the user uploaded images.

Actually, looking more carefully: `resolveRoute()` runs inside `createCodingAgent()` which is called from `websiteBuilderNode`. By that time, `websiteBuilderNode` has already called `injectAgentContext()` and passed the enriched messages. So `options.messages` WILL contain the image context messages.

**Changes** in `resolveRoute()`, after the `options.systemPrompt` check and before the classifier call:

```ts
// Check if messages contain image context (multimodal blocks from injectAgentContext)
const hasImageContext = options.messages.some((msg) => {
  // Check for multimodal content (image_url blocks)
  if (Array.isArray(msg.content)) {
    return msg.content.some((block: any) => block.type === "image_url");
  }
  // Check for text context messages about images
  const content = typeof msg.content === "string" ? msg.content : "";
  return content.includes("[Context]") && content.includes("image");
});

if (hasImageContext) {
  getLogger().info("Image context detected, routing to full agent");
  return { route: "full" };
}
```

This ensures that when `injectAgentContext` adds multimodal image messages or text context about images, the classifier is bypassed and we go straight to the full agent. Image swaps inherently touch multiple files (HTML references, possibly adding imports), so full agent is the right choice.

---

## Step 4: E2E Tests

**Approach**: Use `website_generated` snapshot (has existing files) for quick actions that trigger the backend. Use `website_step` for UI-only tests. Keep tests minimal — just verify the UI renders and intents fire.

### 4a. Page Object Updates

**File**: `rails_app/e2e/pages/website.page.ts`

Add locators:

```ts
readonly updateImagesButton: Locator;  // button:has-text("Update Page with Images")
readonly improveCopyOptions: Locator;  // buttons inside improve copy section
```

Add helpers:

```ts
async clickImproveCopyOption(label: string): Promise<void> {
  await this.page.locator(`button:has-text("${label}")`).click();
}
```

### 4b. New Test Cases

**File**: `rails_app/e2e/website.spec.ts`

Add to the "Quick Actions" describe block:

1. **Swap Images expand** — click Swap Images, verify Images section visible
2. **Improve Copy expand** — click Improve Copy, verify "Update Copy" label visible
3. **Toggle off** — click same button twice, verify panel closes
4. **Improve Copy triggers intent** (uses `website_generated` snapshot):
   - Restore `website_generated`, navigate, wait for chat ready
   - Click Improve Copy, click "Make tone more professional"
   - Verify streaming indicator appears (intent was sent to backend)
5. **Chat edit triggers response** (uses `website_generated` snapshot):
   - Restore `website_generated`, navigate, wait for chat ready
   - Send "Make the headline bigger"
   - Verify AI response appears

Tests 4-5 depend on CACHE_MODE. The `websiteBuilderSubgraph` has cache mode support. The `improveCopySubgraph` does NOT have cache mode — it goes straight to `createCodingAgent` with `route: "single-shot"`. For the E2E tests, the `improve_copy` intent will make a real API call (Haiku, ~$0.005).

**Alternative**: We could skip test 4 and rely on test 5 (regular chat edit) to verify the full pipeline. The Improve Copy UI test (test 2) verifies the buttons render; the actual intent firing can be a manual verification.

---

## Files Changed

| File                                           | Change                                                 |
| ---------------------------------------------- | ------------------------------------------------------ |
| `rails_app/.../quick-actions/QuickActions.tsx` | Add padding wrapper + "Update Page with Images" button |
| `langgraph_app/app/nodes/coding/agent.ts`      | Image context check in `resolveRoute()`                |
| `rails_app/e2e/website.spec.ts`                | New quick action tests                                 |
| `rails_app/e2e/pages/website.page.ts`          | New locators/helpers                                   |

**No new files. No new intents. No new nodes.**

---

## Verification

1. `pnpm test` in `langgraph_app/` — existing tests pass
2. Manual: open a project at website step, verify padding on all 3 panels
3. Manual: upload images, click "Update Page with Images", verify agent runs with image context
4. `pnpm test:e2e` from `rails_app/` — new tests pass
