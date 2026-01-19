# Deploy Graph Testing Plan (Simplified)

## Context

Users create landing pages to validate business ideas. Two conversion patterns:

| Pattern             | Tracking                                                |
| ------------------- | ------------------------------------------------------- |
| **Tiered Pricing**  | `L10.conversion({ label: 'signup', value: tierPrice })` |
| **Simple Waitlist** | `L10.conversion({ label: 'signup', value: 0 })`         |

## Architecture Decisions

**No verification layer.** Trust the coding agent. If it fails, fix the prompt.

**Env vars for config.** Agent writes `import.meta.env.VITE_GOOGLE_ADS_ID` - values injected at build.

**Shared prompting layer.** Brainstorm/Ads use `app/prompts/` with shared components. Coding agent currently has hardcoded prompts in `agent.ts`. We need a shared layer so tracking context is available to all coding-related agents.

---

## Implementation

### 1. Create Shared Prompting Layer for Coding Agent

**New directory:** `app/prompts/coding/`

```
app/prompts/coding/
├── index.ts                    # Export buildCodingPrompt()
├── shared/
│   ├── codeGuidelines.ts       # Shared code rules (shadcn, Tailwind)
│   ├── environment.ts          # VITE env var docs
│   ├── fileStructure.ts        # Template structure
│   ├── trackingContext.ts      # L10.conversion scenarios
│   └── tools.ts                # Tools documentation
└── bugFix/
    └── systemPrompt.ts         # Bug fix prompt builder (uses shared/)
```

**Tracking context** (`shared/trackingContext.ts`):

```typescript
export const trackingPrompt = () => `
## Conversion Tracking

All landing pages require conversion tracking. Determine the appropriate pattern based on page structure:

### Scenario 1: Tiered Pricing Pages
When the page has pricing tiers (e.g., Basic/Pro/Enterprise), users click a tier to open a waitlist modal.
- Pass the tier price to track conversion value for ROAS
- Example: L10.conversion({ label: 'signup', value: tierPrice })

### Scenario 2: Simple Waitlist/Signup
When the page has a basic signup form without pricing context.
- Track with zero value
- Example: L10.conversion({ label: 'signup', value: 0 })

### Implementation Rules
- Import: import { L10 } from '@/lib/tracking'
- Fire on SUCCESS only (after API success, before thank-you state)
- One conversion per signup, not on every click
- Config uses import.meta.env.VITE_GOOGLE_ADS_ID (injected at build)
`;
```

### 2. Refactor Coding Agent to Use Shared Prompts

**File:** `app/nodes/codingAgent/utils/agent.ts`

Replace hardcoded `CODING_AGENT_SYSTEM_PROMPT` with composed prompt:

```typescript
import { buildCodingPrompt } from "@prompts/coding";

export async function createCodingAgent(state, customPrompt?: string) {
  const systemPrompt = customPrompt || buildCodingPrompt();
  // ... rest unchanged
}
```

### 3. Add Tier Value Support to Existing Instrumentation

**File:** `app/nodes/deploy/instrumentationNode.ts`

~10 line change to pass tier value when detected:

```typescript
// Around line 190, modify the conversion call generation
const conversionCall = analysis.tierPrice
  ? `\n      L10.conversion({ label: '${analysis.formType}', value: ${analysis.tierPrice} });`
  : `\n      L10.conversion({ label: '${analysis.formType}' });`;
```

Update `ConversionAnalysisSchema` to include `tierPrice?: number`.

---

## Tests (8 total)

### Layer 1: tracking.ts Unit Tests (3)

**File:** `tests/tests/lib/tracking.test.ts`

| Test                                            | What it verifies                |
| ----------------------------------------------- | ------------------------------- |
| `fires gtag with correct send_to format`        | gtag called with `AW-xxx/label` |
| `looks up semantic label from conversionLabels` | Config lookup works             |
| `passes value and currency correctly`           | ROAS tracking works             |

### Layer 2: Coding Agent Tracking Tests (3)

**File:** `tests/tests/nodes/codingAgent/tracking.test.ts`

| Test                                       | What it verifies             |
| ------------------------------------------ | ---------------------------- |
| `tiered pricing -> tracks with tier value` | Value param included         |
| `simple form -> tracks with value: 0`      | Zero value for basic signups |
| `adds L10 import when needed`              | Import statement added       |

### Layer 3: Deployment Tests (2)

**File:** `tests/tests/graphs/deploy/deployWebsite.test.ts` (add to existing)

| Test                                 | What it verifies         |
| ------------------------------------ | ------------------------ |
| `marks task failed on webhook error` | Failure handling         |
| `preserves error details`            | Debugging info available |

---

## Database Snapshots (2)

| Snapshot                     | Contents                                 |
| ---------------------------- | ---------------------------------------- |
| `website_with_pricing_tiers` | Page with pricing component, no tracking |
| `website_with_simple_form`   | Page with signup form, no tracking       |

---

## Files to Modify

| File                                              | Change                              |
| ------------------------------------------------- | ----------------------------------- |
| `app/prompts/coding/index.ts`                     | NEW: Export buildCodingPrompt()     |
| `app/prompts/coding/shared/trackingContext.ts`    | NEW: Tracking scenarios prompt      |
| `app/prompts/coding/shared/codeGuidelines.ts`     | NEW: Extract from agent.ts          |
| `app/prompts/coding/shared/environment.ts`        | NEW: VITE env var docs              |
| `app/prompts/coding/shared/fileStructure.ts`      | NEW: Template structure             |
| `app/prompts/coding/shared/tools.ts`              | NEW: Tools documentation            |
| `app/prompts/coding/bugFix/systemPrompt.ts`       | NEW: Bug fix prompt using shared/   |
| `app/nodes/codingAgent/utils/agent.ts`            | Refactor to use buildCodingPrompt() |
| `app/nodes/deploy/bugFixNode.ts`                  | Use new bugFix prompt builder       |
| `app/nodes/deploy/instrumentationNode.ts`         | Add tierPrice to schema + ~10 lines |
| `tests/tests/lib/tracking.test.ts`                | NEW                                 |
| `tests/tests/nodes/codingAgent/tracking.test.ts`  | NEW                                 |
| `tests/tests/graphs/deploy/deployWebsite.test.ts` | ADD 2 tests                         |
| `tests/fixtures/database/snapshots/`              | ADD 2 snapshots                     |

---

## Verification

1. `pnpm test tests/tests/lib/tracking.test.ts` - Unit tests pass
2. `pnpm test tests/tests/nodes/codingAgent/tracking.test.ts` - Agent adds tracking
3. `pnpm test tests/tests/graphs/deploy/deployWebsite.test.ts` - Deploy flow works
4. Manual: Create tiered page → deploy → verify tracking fires with value

---

## Implementation Order

1. **Create shared prompting layer** (`app/prompts/coding/`)
   - Extract existing prompt sections from agent.ts into shared/
   - Add trackingContext.ts with the two scenarios
   - Create buildCodingPrompt() that composes all sections

2. **Refactor coding agent** to use new shared prompts
   - Verify existing behavior unchanged

3. **Add tier value support** to instrumentationNode (~10 lines)

4. **Write tests** (8 total)
   - tracking.ts unit tests first (foundation)
   - Then integration tests

---

## What We're NOT Doing

- ❌ Verification/fix loop (over-engineering)
- ❌ Testing LLM inference reliability (flaky by design)
- ❌ Edge case snapshots (YAGNI)
- ❌ Instrumentation node refactor (existing code works)
