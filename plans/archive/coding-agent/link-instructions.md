# Plan: Coding Agent Link Instructions

## Summary

Add clear instructions to the coding agent's system prompt for proper link handling. Prevents broken links at generation time rather than catching them after.

## Why This Matters

The static validation catches broken links, but better to prevent them. These instructions teach the agent the correct patterns upfront.

---

## Instructions to Add

Add to `CODER_SYSTEM_PROMPT` in `coder.ts`:

```markdown
## Link Patterns

### Page Routes (React Router)

When creating a new page:

1. Create component in \`/src/pages/\` (e.g., \`PricingPage.tsx\`)
2. Add route in \`/src/App.tsx\` ABOVE the catch-all route: \`<Route path="/pricing" element={<PricingPage />} />\`
3. Link with \`<a href="/pricing">\` or use \`<Link to="/pricing">\` from react-router-dom

### Anchor Links (Same Page)

Use \`<a href="#features">\` to link to elements with \`id="features"\` on the same page.

### Common Mistakes to Avoid

| Wrong                           | Right                               | Why                                 |
| ------------------------------- | ----------------------------------- | ----------------------------------- |
| \`href="/pricing.html"\`        | \`href="/pricing"\`                 | No .html extensions in React Router |
| \`href="#Features"\`            | \`href="#features"\`                | IDs are case-sensitive              |
| \`href="/about"\` without Route | Add \`<Route path="/about">\` first | Routes must be defined              |
| \`href="pricing"\`              | \`href="/pricing"\`                 | Always use leading slash for routes |
```

---

## Implementation

**File to modify:** `langgraph_app/app/nodes/codingAgent/subagents/coder.ts`

**Location:** Add to `CODER_SYSTEM_PROMPT` constant, after "## File Locations" section.

**Why coder subagent:** The coder subagent is the one that actually writes `<a href>` tags. The main agent orchestrates, but the coder implements.

**Note:** React Router is already included in the template (`react-router-dom: ^6.26.2`). App.tsx already has the routing structure with a helpful comment: `{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}`.

---

## RED (Acceptance Criteria)

- [ ] No tests verify link generation behavior
- [ ] No tests verify coder prompt contains link instructions

## GREEN (Implementation)

### Prompt Change (Done)

- [x] Add link instructions to `CODER_SYSTEM_PROMPT` in `coder.ts`

### Tests to Add

**File:** `tests/tests/nodes/codingAgent/subagents/coder.test.ts` (Create)

```typescript
describe("Coder Subagent System Prompt", () => {
  it("includes link pattern instructions", () => {
    expect(prompt).toContain("## Link Patterns");
  });

  it("explains page routes with React Router", () => {
    expect(prompt).toContain("ABOVE the catch-all route");
  });

  it("includes common mistakes table", () => {
    expect(prompt).toContain("Common Mistakes to Avoid");
  });
});
```

**File:** `tests/tests/graphs/codingAgent/codingAgent.test.ts` (Modify)

```typescript
describe("Link Generation", () => {
  it("generates valid route when creating a new page", async () => {
    // Verify route added ABOVE catch-all in App.tsx
  });

  it("uses correct href format (leading slash, no .html)", async () => {
    // Verify /pricing not pricing.html
  });

  it("generates lowercase anchor IDs matching hrefs", async () => {
    // Verify id="features" matches href="#features"
  });
});
```

## REFACTOR

- [ ] N/A - prompt change only

---

## Verification

After implementation, the static validation (from `plans/coding-agent-static-validation.md`) should catch fewer errors because the agent generates correct links from the start.
