# Plan: Coding Agent Link Instructions

## Summary

Add clear instructions to the coding agent's system prompt for proper link handling. Prevents broken links at generation time rather than catching them after.

## Why This Matters

The static validation catches broken links, but better to prevent them. These instructions teach the agent the correct patterns upfront.

---

## Instructions to Add

Add to the coding agent's system prompt:

```markdown
## Link Patterns

### Page Routes (React Router)

To link to another page:

1. Create the page component in `src/pages/`:
   ```tsx
   // src/pages/PricingPage.tsx
   export function PricingPage() {
     return <div>Pricing content</div>;
   }
   ```

2. Add the route in `src/App.tsx`:
   ```tsx
   <Route path="/pricing" element={<PricingPage />} />
   ```

3. Link to it:
   ```tsx
   <a href="/pricing">Pricing</a>
   ```

### Anchor Links (Same Page)

To link to a section on the same page:

1. Add an `id` to the target:
   ```tsx
   <section id="features">...</section>
   ```

2. Link to it:
   ```tsx
   <a href="#features">Features</a>
   ```

### Common Mistakes to Avoid

| Wrong | Right | Why |
|-------|-------|-----|
| `href="/pricing.html"` | `href="/pricing"` | No .html extensions in React Router |
| `href="#Features"` | `href="#features"` | IDs are case-sensitive |
| `href="/about"` without Route | Add `<Route path="/about">` first | Routes must be defined |
| `href="pricing"` | `href="/pricing"` | Always use leading slash for routes |
```

---

## Implementation

**File to modify:** The coding agent's system prompt (location TBD based on prompt architecture).

This is a documentation/prompt change only. No code changes required.

---

## Verification

After implementation, the static validation (from `plans/coding-agent-static-validation.md`) should catch fewer errors because the agent generates correct links from the start.
