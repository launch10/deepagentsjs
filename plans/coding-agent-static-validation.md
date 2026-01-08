# Plan: In-Loop Static Validation

## Summary

Add fast, static validation that runs after the coding agent generates code. If validation fails, feed errors back to the agent for self-correction (up to 2 retries).

## Dependencies

- **`plans/atlas-spa-fallback.md`** - Atlas must support SPA fallback for route-based link validation to work.

## Current State

**Current graph flow:**
```
buildContext → codingAgent → cleanup
```

**Target flow:**
```
buildContext → codingAgent → staticValidation → [pass] → cleanup
                    ↑              ↓
                    └── [fail] ────┘
```

## Validation Checks

### 1. Link Validation

| Link Pattern | Example | Validation Rule |
|--------------|---------|-----------------|
| Anchor | `href="#pricing"` | Must have element with `id="pricing"` |
| Route | `href="/pricing"` | Must have `<Route path="/pricing">` in App.tsx |
| Asset | `src="/images/hero.png"` | File must exist in project |
| External | `href="https://example.com"` | Skip |
| Email/Tel | `href="mailto:hi@example.com"` | Skip |

### 2. Build Validation

- Run `tsc --noEmit` to catch TypeScript errors
- Parse output, format for agent

---

## Implementation

### Files to Create

#### 1. Link Validator

**File:** `langgraph_app/app/services/editor/validation/linkValidator.ts`

```typescript
import { CodeFile } from '../types';

export interface LinkValidationError {
  type: 'anchor' | 'route' | 'asset';
  message: string;
  file: string;
}

function getLinkType(href: string): 'anchor' | 'route' | 'asset' | 'external' | 'skip' {
  if (href.startsWith('#')) return 'anchor';
  if (href.startsWith('http://') || href.startsWith('https://')) return 'external';
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return 'skip';
  if (hasFileExtension(href)) return 'asset';
  return 'route';
}

function hasFileExtension(path: string): boolean {
  const filename = path.split('/').pop() || '';
  return filename.includes('.') && !filename.startsWith('.');
}

function normalizeFilePath(path: string): string {
  let normalized = path;
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(1);
  }
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  return normalized;
}

function parseRoutesFromAppTsx(files: CodeFile[]): Set<string> {
  const appFile = files.find(f => f.path.endsWith('App.tsx'));
  if (!appFile) return new Set(['/']);

  const routes = new Set<string>();
  const routeMatches = appFile.content.matchAll(/<Route\s+path=["']([^"']+)["']/g);

  for (const match of routeMatches) {
    const path = match[1];
    if (path !== '*') {
      routes.add(path.replace(/\/$/, '') || '/');
    }
  }

  routes.add('/');
  return routes;
}

export async function validateLinks(files: CodeFile[]): Promise<LinkValidationError[]> {
  const errors: LinkValidationError[] = [];

  // 1. Collect all anchor IDs
  const anchors = new Set<string>();
  for (const file of files) {
    const idMatches = file.content.matchAll(/id=["']([^"']+)["']/g);
    for (const match of idMatches) {
      anchors.add(match[1]);
    }
  }

  // 2. Parse routes from App.tsx
  const routes = parseRoutesFromAppTsx(files);

  // 3. Collect static file paths
  const staticFiles = new Set(
    files
      .filter(f => hasFileExtension(f.path))
      .map(f => normalizeFilePath(f.path))
  );

  // 4. Validate each href
  for (const file of files) {
    const hrefMatches = file.content.matchAll(/href=["']([^"']+)["']/g);

    for (const match of hrefMatches) {
      const href = match[1];
      const linkType = getLinkType(href);

      switch (linkType) {
        case 'anchor':
          const anchorId = href.slice(1);
          if (!anchors.has(anchorId)) {
            errors.push({
              type: 'anchor',
              message: `Broken anchor: ${href} (no element with id="${anchorId}")`,
              file: file.path,
            });
          }
          break;

        case 'route':
          const normalizedRoute = href.replace(/\/$/, '') || '/';
          if (!routes.has(normalizedRoute)) {
            errors.push({
              type: 'route',
              message: `No route defined for: ${href} (add <Route path="${normalizedRoute}"> to App.tsx)`,
              file: file.path,
            });
          }
          break;

        case 'asset':
          if (!staticFiles.has(normalizeFilePath(href))) {
            errors.push({
              type: 'asset',
              message: `Missing file: ${href}`,
              file: file.path,
            });
          }
          break;
      }
    }
  }

  return errors;
}
```

#### 2. Static Validation Service

**File:** `langgraph_app/app/services/editor/validation/staticValidationService.ts`

```typescript
import { validateLinks, LinkValidationError } from './linkValidator';
import { CodeFile } from '../types';

export interface ValidationError {
  type: 'link' | 'build';
  message: string;
  file?: string;
  line?: number;
}

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
}

export class StaticValidationService {
  async validate(files: CodeFile[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Link validation
    const linkErrors = await validateLinks(files);
    for (const err of linkErrors) {
      errors.push({
        type: 'link',
        message: err.message,
        file: err.file,
      });
    }

    // Build validation (TypeScript) - optional, can be added later
    // const buildErrors = await this.validateBuild(files);
    // errors.push(...buildErrors);

    return {
      passed: errors.length === 0,
      errors,
    };
  }
}
```

#### 3. Validation Index

**File:** `langgraph_app/app/services/editor/validation/index.ts`

```typescript
export { StaticValidationService, ValidationResult, ValidationError } from './staticValidationService';
export { validateLinks, LinkValidationError } from './linkValidator';
```

#### 4. Static Validation Node

**File:** `langgraph_app/app/nodes/codingAgent/staticValidation.ts`

```typescript
import { CodingAgentGraphState } from '../../annotation/codingAgentAnnotation';
import { StaticValidationService, ValidationError } from '../../services/editor/validation';

function formatValidationErrors(errors: ValidationError[]): string {
  const lines = ['## Validation Failed\n'];
  lines.push('The following issues were found in your generated code:\n');

  const linkErrors = errors.filter(e => e.type === 'link');
  const buildErrors = errors.filter(e => e.type === 'build');

  if (linkErrors.length > 0) {
    lines.push('### Link Errors');
    for (const err of linkErrors) {
      lines.push(`- ${err.file}: ${err.message}`);
    }
    lines.push('');
  }

  if (buildErrors.length > 0) {
    lines.push('### Build Errors');
    for (const err of buildErrors) {
      const location = err.line ? `${err.file}:${err.line}` : err.file;
      lines.push(`- ${location}: ${err.message}`);
    }
    lines.push('');
  }

  lines.push('Please fix these issues and regenerate the affected files.');

  return lines.join('\n');
}

export const staticValidation = async (
  state: CodingAgentGraphState,
): Promise<Partial<CodingAgentGraphState>> => {
  const validationService = new StaticValidationService();
  const result = await validationService.validate(state.files);

  if (result.passed) {
    return { validationPassed: true };
  }

  const errorMessage = formatValidationErrors(result.errors);

  return {
    validationPassed: false,
    validationErrors: result.errors,
    retryCount: state.retryCount + 1,
    messages: [...state.messages, { role: 'user', content: errorMessage }],
  };
};
```

### Files to Modify

#### 5. Update State Annotation

**File:** `langgraph_app/app/annotation/codingAgentAnnotation.ts`

Add fields:
```typescript
validationPassed: Annotation<boolean>({ default: () => false }),
validationErrors: Annotation<ValidationError[]>({ default: () => [] }),
retryCount: Annotation<number>({ default: () => 0 }),
```

#### 6. Update Graph

**File:** `langgraph_app/app/graphs/codingAgent.ts`

```typescript
import { staticValidation } from '../nodes/codingAgent/staticValidation';

// ... existing setup ...

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

---

## Agent Instructions

These rules should be included in the coding agent's system prompt:

### Adding a New Page

1. Create the page component: `src/pages/PricingPage.tsx`
2. Add the route in `src/App.tsx`:
   ```tsx
   <Route path="/pricing" element={<PricingPage />} />
   ```
3. Link to it: `<a href="/pricing">Pricing</a>`

### Adding Anchor Links (Same Page)

1. Add an `id` to the target element:
   ```tsx
   <section id="features">...</section>
   ```
2. Link to it: `<a href="#features">Features</a>`

### Adding Images/Assets

1. Place the file in `public/` or `src/assets/`
2. Reference it:
   - From `public/`: `<img src="/images/hero.png" />`
   - From `src/assets/`: `import hero from '@/assets/hero.png'`

### Common Mistakes

| Mistake | Correct |
|---------|---------|
| `href="/pricing.html"` | `href="/pricing"` |
| `href="#Features"` (case mismatch) | `href="#features"` + `id="features"` |
| Linking to `/about` without Route | Add `<Route path="/about">` first |
| `src="images/logo.png"` (no leading /) | `src="/images/logo.png"` |

---

## Files Summary

| Action | File |
|--------|------|
| Create | `langgraph_app/app/services/editor/validation/linkValidator.ts` |
| Create | `langgraph_app/app/services/editor/validation/staticValidationService.ts` |
| Create | `langgraph_app/app/services/editor/validation/index.ts` |
| Create | `langgraph_app/app/nodes/codingAgent/staticValidation.ts` |
| Modify | `langgraph_app/app/nodes/codingAgent/index.ts` (add export) |
| Modify | `langgraph_app/app/annotation/codingAgentAnnotation.ts` (add fields) |
| Modify | `langgraph_app/app/graphs/codingAgent.ts` (add node + conditional edge) |
