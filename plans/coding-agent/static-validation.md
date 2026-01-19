---
status: approved
approved_date: 2026-01-08
reviewers:
  - DHH Rails Reviewer
  - Kieran Rails Reviewer
  - Code Simplicity Reviewer
review_rounds: 3
phase: 2
depends_on:
  - atlas-spa-fallback.md
  - coding-agent-link-instructions.md
files_to_create:
  - langgraph_app/app/nodes/codingAgent/staticValidation.ts
files_to_modify:
  - langgraph_app/app/nodes/codingAgent/index.ts
  - langgraph_app/app/graphs/codingAgent.ts
---

# Plan: In-Loop Static Validation

## Summary

Add fast, static validation after the coding agent generates code. If validation fails, feed errors back to the agent for self-correction (up to 2 retries). For today, this is just for link validation.

## Dependencies

- **`plans/atlas-spa-fallback.md`** - Atlas must support SPA fallback for route validation to work.
- **`plans/coding-agent-link-instructions.md`** - Agent instructions for proper link patterns.

## Current State

```
buildContext → codingAgent → cleanup
```

## Target State

```
buildContext → codingAgent → staticValidation → [pass] → cleanup
                    ↑              ↓
                    └── [fail] ────┘
```

---

## Implementation

### 1. Create Static Validation Node

**File:** `langgraph_app/app/nodes/codingAgent/staticValidation.ts`

One file. Everything inline. No service class.

```typescript
import type { CodingAgentGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { HumanMessage } from "@langchain/core/messages";
import { db, codeFiles, eq } from "@db";

const MAX_VALIDATION_RETRIES = 2;

interface ValidationError {
  file: string;
  message: string;
}

type LinkType = "anchor" | "route" | "skip";

function getLinkType(href: string): LinkType {
  if (href.startsWith("#")) return "anchor";
  if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:"))
    return "skip";
  return "route";
}

function collectAnchors(files: { path: string; content: string }[]): Set<string> {
  const anchors = new Set<string>();
  for (const file of files) {
    const matches = file.content.matchAll(/id=["']([^"']+)["']/g);
    for (const match of matches) {
      anchors.add(match[1]);
    }
  }
  return anchors;
}

function parseRoutes(files: { path: string; content: string }[]): Set<string> {
  const appFile = files.find((f) => f.path.endsWith("App.tsx"));
  if (!appFile) return new Set(["/"]);

  const routes = new Set<string>(["/"]);
  const matches = appFile.content.matchAll(/<Route\s+path=["']([^"']+)["']/g);
  for (const match of matches) {
    if (match[1] !== "*") {
      routes.add(match[1].replace(/\/$/, "") || "/");
    }
  }
  return routes;
}

function validateLinks(files: { path: string; content: string }[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const anchors = collectAnchors(files);
  const routes = parseRoutes(files);

  for (const file of files) {
    const matches = file.content.matchAll(/href=["']([^"']+)["']/g);

    for (const match of matches) {
      const href = match[1];
      const linkType = getLinkType(href);

      if (linkType === "anchor") {
        const id = href.slice(1);
        if (!anchors.has(id)) {
          errors.push({
            file: file.path,
            message: `Broken anchor: ${href} - no element with id="${id}"`,
          });
        }
      } else if (linkType === "route") {
        // Strip query strings and trailing slashes before checking
        const [pathPart] = href.split("?");
        const normalized = (pathPart || "").replace(/\/$/, "") || "/";
        if (!routes.has(normalized)) {
          errors.push({
            file: file.path,
            message: `No route for: ${href} - add <Route path="${normalized}"> to App.tsx`,
          });
        }
      }
    }
  }

  return errors;
}

export const staticValidationNode = NodeMiddleware.use(
  {},
  async (
    state: CodingAgentGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<CodingAgentGraphState>> => {
    if (!state.websiteId) {
      return { status: "completed" };
    }

    // Fetch files from database (websiteId is number, matches bigint column)
    const rawFiles = await db
      .select({ path: codeFiles.path, content: codeFiles.content })
      .from(codeFiles)
      .where(eq(codeFiles.websiteId, state.websiteId));

    // Filter out files with null path or content
    const files = rawFiles.filter(
      (f): f is { path: string; content: string } => f.path !== null && f.content !== null
    );

    const errors = validateLinks(files);

    if (errors.length === 0) {
      return { status: "completed" };
    }

    // Check retry limit
    if (state.errorRetries >= MAX_VALIDATION_RETRIES) {
      return { status: "completed" };
    }

    // Format errors and retry
    const errorList = errors.map((e) => `- ${e.file}: ${e.message}`).join("\n");

    return {
      errorRetries: state.errorRetries + 1,
      messages: [new HumanMessage(`Validation failed:\n${errorList}\n\nFix these issues.`)],
    };
  }
);
```

### 2. Export from Index

**File:** `langgraph_app/app/nodes/codingAgent/index.ts`

Add export:

```typescript
export * from "./staticValidation";
```

### 3. Update Graph

**File:** `langgraph_app/app/graphs/codingAgent.ts`

```typescript
import { staticValidationNode } from "@nodes";

// ... existing setup ...

graph
  .addNode("buildContext", buildContext)
  .addNode("codingAgent", codingAgentNode)
  .addNode("staticValidation", staticValidationNode)
  .addNode("cleanup", cleanupNode)
  .addEdge("buildContext", "codingAgent")
  .addEdge("codingAgent", "staticValidation")
  .addConditionalEdges("staticValidation", (state) =>
    state.status === "completed" ? "cleanup" : "codingAgent"
  )
  .addEdge("cleanup", END);
```

---

## Validation Rules

| Link Pattern | Example                  | Rule                                            |
| ------------ | ------------------------ | ----------------------------------------------- |
| Anchor       | `href="#pricing"`        | Element with `id="pricing"` must exist          |
| Route        | `href="/pricing"`        | `<Route path="/pricing">` must exist in App.tsx |
| Route + QS   | `href="/pricing?ref=nav"`| Query string stripped, validates `/pricing`     |
| External     | `href="https://..."`     | Skip                                            |
| Email/Tel    | `href="mailto:..."`      | Skip                                            |

### Regex Limitations

The validation uses simple regex patterns that assume single-line JSX. This is intentional—the coding agent is instructed to use simple patterns.

**Supported:**
- `<Route path="/pricing" />` (single line)
- `id="section-name"` (static IDs)
- `href="/about"` (static hrefs)

**Not Supported (by design):**
- Multi-line JSX: `<Route\n  path="/pricing"\n/>`
- Template literals: `` path={`/pricing`} ``
- Dynamic values: `path={ROUTE_PATH}` or `id={sectionId}`

The linked plan `coding-agent-link-instructions.md` instructs the agent to use only supported patterns.

---

## Files Summary

| Action | File                                                      |
| ------ | --------------------------------------------------------- |
| Create | `langgraph_app/app/nodes/codingAgent/staticValidation.ts` |
| Modify | `langgraph_app/app/nodes/codingAgent/index.ts`            |
| Modify | `langgraph_app/app/graphs/codingAgent.ts`                 |

---

## Not Included (YAGNI)

- **Asset validation** (`src="/images/..."`) - Images are external URLs, not local files
- **TypeScript build validation** - Add when needed
- **Separate service class** - One function is enough
- **`validationPassed` state field** - Use `status` instead
- **`validationErrors` state field** - Errors go in messages only

---

## History

### 2026-01-08: Review Round 3 - Approved

**Reviewers:** DHH Rails Reviewer, Kieran Rails Reviewer, Code Simplicity Reviewer

**Verdict:** All three reviewers approved. Plan is ready to implement.

- DHH: "Ship it. The plan follows Rails principles despite being TypeScript."
- Kieran: "All critical issues resolved correctly. Ship it."
- Code Simplicity: "No further simplification needed. Ship it."

**Optional enhancement noted:** Route+anchor combinations (`/about#team`) could be handled by changing `split("?")` to `split(/[?#]/)`. Can be added during implementation if needed.

---

### 2026-01-08: Review Round 2 - Technical Fixes

**Reviewers:** DHH Rails Reviewer, Kieran Rails Reviewer, Code Simplicity Reviewer

#### Feedback Summary

**DHH Review - "Ship it."**
- Plan is appropriately simple now
- One file, everything inline, no service class
- YAGNI properly practiced
- No blocking issues

**Kieran Review - "Critical issues identified."**
- `codeFiles.path` and `codeFiles.content` are nullable in schema
- Query strings in routes (`/pricing?ref=nav`) would fail validation
- Redundant retry check in conditional edges (node sets `status`, graph re-checks `errorRetries`)
- Regex limitations should be documented

**Code Simplicity Review - "Already minimal - proceed."**
- Previous 41% reduction captured the real waste
- Only minor item: redundant retry check in conditional edges

#### Changes Made

| Issue | Fix |
|-------|-----|
| Nullable fields from DB | Added null filtering with type guard after query |
| Query strings in routes | Strip `?` params before validation |
| Redundant retry check | Simplified conditional edge to check only `status` |
| Regex limitations undocumented | Added "Regex Limitations" section |

---

### 2025-01-08: Plan Simplified After Review

**Reviewers:** DHH Rails Reviewer, Kieran Rails Reviewer, Code Simplicity Reviewer

#### Feedback Received

**DHH Review - "Over-engineered. Ship simpler."**

- "Service Object Disease" - 3 files for link validation is too much
- `StaticValidationService` is a pass-through wrapper adding zero value
- Two nearly identical error types mapping between each other
- Over-formatted Markdown error messages when AI can read JSON
- State pollution with 3 new fields when retries should be internal

**Kieran Review - "Critical issues must be fixed."**

- `state.files` doesn't exist - must fetch from database using `websiteId`
- Wrong type import path (`../types` doesn't exist)
- Duplicate state field - `retryCount` when `errorRetries` already exists
- Missing `NodeMiddleware.use()` wrapper
- Message reducer misuse - can't spread `state.messages` directly
- Missing `src` attribute validation (plan table vs code mismatch)

**Code Simplicity Review - "35-40% of code is unnecessary."**

- `StaticValidationService` class wraps single function call
- Redundant type definitions (`LinkValidationError` + `ValidationError`)
- Separate index file for re-exports adds file with no logic
- Commented-out build validation is YAGNI violation
- `validationErrors` state field never read after write
- Asset validation may never trigger (images are external URLs)

#### Decisions Made

| Decision                                    | Rationale                                                           |
| ------------------------------------------- | ------------------------------------------------------------------- |
| Collapse 4 files → 1 file                   | No benefit to separation; service class was pass-through            |
| Remove `StaticValidationService` class      | Plain function is sufficient; class added indirection without value |
| Fetch files from database                   | `state.files` doesn't exist; must query using `websiteId`           |
| Reuse `errorRetries` field                  | Annotation already has this; don't duplicate                        |
| Use `NodeMiddleware.use()`                  | Match existing node patterns in codebase                            |
| Use `HumanMessage` class                    | Required for proper message reducer handling                        |
| Remove asset validation                     | Images are external URLs per state definition                       |
| Remove `validationErrors` from state        | Only used to format message; store in messages only                 |
| Remove `validationPassed` from state        | Use existing `status` field instead                                 |
| Extract agent instructions to separate plan | Different concern; prevention vs detection                          |

#### Result

| Metric             | Before | After | Change |
| ------------------ | ------ | ----- | ------ |
| Lines              | 376    | 220   | -41%   |
| Files to create    | 4      | 1     | -75%   |
| Files to modify    | 3      | 2     | -33%   |
| State fields added | 3      | 0     | -100%  |
| Interface types    | 2      | 1     | -50%   |
