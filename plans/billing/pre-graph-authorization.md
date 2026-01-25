# Pre-Graph Authorization Plan

## Summary

Inject `usagePercent` into `getLLM()` calls before graph execution, enabling model selection based on account usage.

## Current State Analysis

### What's Already Done (Scope 6 Full)
- `usageTracker.ts` ✅ - Captures clean message traces with deduplication
- `persistTrace.ts` ✅ - Writes traces to `llm_conversation_traces`
- `persistUsage.ts` ✅ - Writes usage to `llm_usage`
- `notifyRails.ts` ✅ - Fire-and-forget notification to Rails
- `executeWithTracking.ts` ✅ - Wires persistence into graph execution
- `getLLM()` ✅ - Already attaches `usageTracker` callback and accepts `usagePercent` parameter

### The Gap (Scope 8)
`getLLM()` accepts `usagePercent` (line 59: `const usagePercent = options.usagePercent ?? 0`) but **nothing passes it**:
- All callers use default value of 0
- No pre-graph hook fetches account balance from Rails
- No mechanism injects usagePercent into graph state or LLM calls

### Existing Documentation
- **langgraph_integration.md** lines 99-198: Has detailed pre-graph hook design
- **scopes-of-work.md** lines 511-549: Scope 8 is minimal, just lists deliverables

## What Needs to Be Built

### 1. Rails Endpoint (Already Designed)
```
GET /api/v1/credits/balance
Returns: { total, plan, pack, usagePercentage }
```

### 2. Langgraph Pre-Graph Hook
**File**: `app/core/billing/checkCredits.ts`

```typescript
interface CreditBalance {
  total: number;
  plan: number;
  pack: number;
  usagePercentage: number;
}

export async function checkCreditBalance(accountId: number): Promise<CreditBalance>
export function canStartRun(balance: CreditBalance): boolean
export function getMaxTierForUsage(usagePercentage: number): number
```

### 3. Integration Points

Two approaches for injecting usagePercent:

**Option A: State-based** (from langgraph_integration.md)
- Add `usagePercentage` to CoreGraphState
- Set via pre-graph hook before `graph.invoke()`
- Nodes read from state and pass to `getLLM()`
- **Pros**: Explicit, visible in state
- **Cons**: Requires updating every node that calls getLLM

**Option B: AsyncLocalStorage-based** (cleaner)
- Store usagePercent in existing UsageContext
- getLLM() reads from `getUsageContext()?.usagePercent`
- Set once in `executeWithTracking()` before graph runs
- **Pros**: Transparent to nodes, no changes needed
- **Cons**: Magic, less visible

**Recommended**: Option B - aligns with existing AsyncLocalStorage pattern for usage tracking

### 4. Test Mode Support
Skip credit checks with `testCredits` config flag or when `NODE_ENV !== 'production'`

## Model Selection Thresholds (from langgraph_integration.md)

| Usage % | Available Models | maxTier |
|---------|-----------------|---------|
| 0-50%   | Opus, Sonnet, Haiku | undefined (all) |
| 50-80%  | Sonnet, Haiku | 2 |
| 80-100% | Haiku only | 3+ |
| 100%+   | Blocked (unless pack credits) | N/A |

## Files to Create

### Langgraph
1. `app/core/billing/checkCredits.ts` - Pre-graph credit check
2. Update `app/core/billing/usageTracker.ts` - Add usagePercent to UsageContext
3. Update `app/core/billing/executeWithTracking.ts` - Fetch balance, set usagePercent
4. Update `app/core/llm/llm.ts` - Read usagePercent from context if not passed

### Rails
1. `app/controllers/api/v1/credits_controller.rb` - Balance endpoint
2. Update `config/routes.rb` - Add route

## Implementation Approach

**Recommended: Option B (AsyncLocalStorage-based)**

This approach:
1. Extends the existing `UsageContext` to include `usagePercent`
2. Fetches account balance in `executeWithTracking()` before graph runs
3. Sets usagePercent in context alongside threadId and accountId
4. `getLLM()` reads from context if not explicitly passed

This is transparent to all nodes - they don't need to know about usage percentages.

## Verification Checklist

After implementation:
- [ ] High usage (50-80%) → Opus excluded from getLLM
- [ ] Very high usage (80-100%) → Only Haiku available
- [ ] 100% usage + no packs → Graph blocked before execution
- [ ] 100% usage + pack credits → Allowed to run
- [ ] Test mode → Credit checks skipped

## Dependencies

- **Scope 7 (Credit Charging Pipeline)**: Must be complete so we have credits to check against
- Rails balance endpoint must exist

## Next Steps

1. Complete Scope 7 (Credit Charging Pipeline)
2. Implement Rails balance endpoint
3. Implement `checkCredits.ts`
4. Extend UsageContext with usagePercent
5. Update `executeWithTracking()` to fetch and set balance
6. Update `getLLM()` to read from context
7. Update Scope 8 in `scopes-of-work.md` to reference this doc
