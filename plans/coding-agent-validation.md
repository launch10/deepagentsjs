# Plan: Two-Layer Validation System

## Summary

Add two validation layers:
1. **In-loop validation** (fast, static) - Runs after agent, feeds errors back for retry
2. **Pre-deployment validation** (thorough, runtime) - Runs before deploy with full browser checks

## Current State

**Existing infrastructure:**
- `BrowserErrorCapture` - Playwright-based console error capture
- `ErrorExporter` - Orchestrates FileExporter → WebsiteRunner → BrowserErrorCapture
- `WebsiteRunner` - Runs dev servers in isolation
- `FileExporter` - Exports files to /tmp for validation

**Current graph flow:**
```
buildContext → codingAgent → cleanup
```

## Layer 1: In-Loop Validation (Fast)

**Purpose:** Catch obvious errors quickly, let agent self-correct

**Flow:**
```
buildContext → codingAgent → staticValidation → [pass] → cleanup
                    ↑              ↓
                    └── [fail] ────┘
```

**Checks (static analysis only, no server):**
1. **Link validation**
   - All `href="#anchor"` point to existing `id="anchor"` elements
   - All relative `href="/path"` point to existing files
   - All `src` attributes reference valid assets

2. **Build validation**
   - Run `tsc --noEmit` to catch type errors
   - Parse output, format for agent

---

## Layer 2: Pre-Deployment Validation (Thorough)

**Purpose:** Comprehensive check before user deploys to production

**When:** Called from Deploy flow, not the agent loop

**Checks (uses existing ErrorExporter/WebsiteRunner):**
1. All Layer 1 checks
2. **Runtime validation**
   - Start dev server via WebsiteRunner
   - Load page in Playwright via BrowserErrorCapture
   - Capture console errors, warnings, failed requests
   - Verify page renders without crashes
3. **Screenshot comparison** (future)
4. **Accessibility checks** (future)

## Implementation

### Layer 1 Files (In-Loop Static Validation)

#### 1a. Static Validation Service

**File:** `langgraph_app/app/services/editor/validation/staticValidationService.ts`

```typescript
interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  type: 'link' | 'build';
  message: string;
  file?: string;
  line?: number;
}

class StaticValidationService {
  async validate(websiteId: string, jwt: string): Promise<ValidationResult>
  async validateLinks(files: CodeFile[]): Promise<ValidationError[]>
  async validateBuild(directory: string): Promise<ValidationError[]>
}
```

#### 1b. Static Validation Node

**File:** `langgraph_app/app/nodes/codingAgent/staticValidation.ts`

```typescript
export const staticValidation = async (
  state: CodingAgentGraphState,
): Promise<Partial<CodingAgentGraphState>> => {
  const validationService = new StaticValidationService();
  const result = await validationService.validate(state.websiteId, state.jwt);

  if (result.passed) {
    return { validationPassed: true };
  }

  // Format errors for agent
  const errorMessage = formatValidationErrors(result.errors);

  return {
    validationPassed: false,
    validationErrors: result.errors,
    messages: [...state.messages, { role: 'user', content: errorMessage }],
  };
};
```

#### 1c. Update Graph with Conditional Edge

**File:** `langgraph_app/app/graphs/codingAgent.ts`

```typescript
graph
  .addNode("buildContext", buildContext)
  .addNode("codingAgent", codingAgentNode)
  .addNode("staticValidation", staticValidation)
  .addNode("cleanup", cleanup)
  .addEdge("buildContext", "codingAgent")
  .addEdge("codingAgent", "staticValidation")
  .addConditionalEdges("staticValidation", (state) => {
    if (state.validationPassed || state.retryCount >= 2) {
      return "cleanup";
    }
    return "codingAgent";  // Retry with validation feedback
  })
  .addEdge("cleanup", END);
```

#### 1d. Update State Annotation

**File:** `langgraph_app/app/annotation/codingAgentAnnotation.ts`

Add fields:
```typescript
validationPassed: Annotation<boolean>({ default: () => false }),
validationErrors: Annotation<ValidationError[]>({ default: () => [] }),
retryCount: Annotation<number>({
  default: () => 0,
  reducer: (current, next) => next ?? current + 1
}),
```

## Files to Create/Modify

### Layer 1 (In-Loop - This Plan)

1. `langgraph_app/app/services/editor/validation/staticValidationService.ts` (create)
2. `langgraph_app/app/services/editor/validation/linkValidator.ts` (create)
3. `langgraph_app/app/services/editor/validation/index.ts` (create)
4. `langgraph_app/app/nodes/codingAgent/staticValidation.ts` (create)
5. `langgraph_app/app/nodes/codingAgent/index.ts` (modify - add export)
6. `langgraph_app/app/annotation/codingAgentAnnotation.ts` (modify - add fields)
7. `langgraph_app/app/graphs/codingAgent.ts` (modify - add node and conditional edge)

### Layer 2 (Pre-Deploy - Future Plan)

Uses existing infrastructure:
- `ErrorExporter` + `BrowserErrorCapture` + `WebsiteRunner`
- Hook into Deploy flow (separate plan)

## Link Validation Logic

```typescript
// Static analysis - no need to run the server
async validateLinks(files: CodeFile[]): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const anchors = new Set<string>();
  const filePaths = new Set(files.map(f => f.path));

  // First pass: collect all anchor IDs
  for (const file of files) {
    const idMatches = file.content.matchAll(/id=["']([^"']+)["']/g);
    for (const match of idMatches) {
      anchors.add(match[1]);
    }
  }

  // Second pass: validate links
  for (const file of files) {
    // Check href attributes
    const hrefMatches = file.content.matchAll(/href=["']([^"']+)["']/g);
    for (const match of hrefMatches) {
      const href = match[1];
      if (href.startsWith('#')) {
        // Anchor link
        if (!anchors.has(href.slice(1))) {
          errors.push({
            type: 'link',
            message: `Broken anchor link: ${href}`,
            file: file.path,
          });
        }
      } else if (!href.startsWith('http') && !href.startsWith('mailto:')) {
        // Relative path
        if (!filePaths.has(href) && !filePaths.has(`/src${href}`)) {
          errors.push({
            type: 'link',
            message: `Broken relative link: ${href}`,
            file: file.path,
          });
        }
      }
    }
  }

  return errors;
}
```

## Retry Message Format

```
## Validation Failed

The following issues were found in your generated code:

### Link Errors
- Hero.tsx: Broken anchor link: #pricing (no element with id="pricing" found)

### Build Errors
- Features.tsx:15: Property 'foo' does not exist on type 'Props'

Please fix these issues and regenerate the affected files.
```
