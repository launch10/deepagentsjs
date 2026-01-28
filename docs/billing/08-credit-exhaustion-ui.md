# Credit Exhaustion UI

## Overview

The frontend tracks credit balances via a Zustand store and presents modals and input gating when credits are low or exhausted.

## How It Works

### Credit Store

The `creditStore` is a Zustand store with localStorage persistence. It receives credit state from three sources:

1. **Langgraph stream** — `updateFromCreditStatus()` receives `creditStatus` with `estimatedRemainingMillicredits` and `justExhausted` after each graph run
2. **402 response** — `updateFromBalanceCheck()` receives balance data when a pre-run check fails
3. **Inertia page props** — `hydrateFromPageProps()` receives credit data on page load (already converted to credits)

The store converts millicredits to credits at the boundary (division by 1000).

### Warning Thresholds

| Condition | Trigger | UI Response |
|-----------|---------|-------------|
| Credits exhausted | `balance <= 0` | Out-of-credits modal, chat input disabled |
| Low credits | Usage >= 80% of allocation | Low-credit warning modal |

### Modal Behavior

The `CreditWarningModal` is a unified component that handles both states:

- **Exhausted variant**: Shows when `isOutOfCredits` is true. Displays "You're out of credits" with progress bar at 100%.
- **Low credit variant**: Shows when usage exceeds `LOW_CREDIT_WARNING_THRESHOLD_PERCENT` (80%). Displays remaining credits and usage percentage.

Both variants show:
- Progress bar (remaining vs total credits)
- Reset date (when next allocation occurs)
- "Upgrade Plan" button
- "Purchase Credits" button

### Modal Suppression

To avoid nagging users:

- **Out-of-credits modal**: Suppressed for 1 hour after dismissal (`modalDismissedAt`)
- **Low-credit warning**: Suppressed for 24 hours after dismissal (`dismissLowCreditWarning()`)

### Chat Input Gating

`CreditGate` wraps the chat input component. When credits are exhausted:
- Shows a "Purchase credits to use AI" link instead of the chat input
- When credits are available, renders children normally with no overhead

## Key Files

| File | Purpose |
|------|---------|
| `rails_app/app/javascript/frontend/stores/creditStore.ts` | Zustand store with persistence |
| `rails_app/app/javascript/frontend/components/credits/CreditWarningModal.tsx` | Unified warning/exhaustion modal |
| `rails_app/app/javascript/frontend/components/shared/chat/input/CreditGate.tsx` | Chat input gating component |

## Key Concepts

### Store State

| Field | Type | Description |
|-------|------|-------------|
| `balance` | number | Total credits remaining (in credits, not millicredits) |
| `planCredits` | number | Plan credit balance |
| `packCredits` | number | Pack credit balance |
| `planCreditsAllocated` | number | Total plan credits for current period |
| `periodEndsAt` | string | When current billing period ends |
| `isOutOfCredits` | boolean | Whether balance is 0 |
| `showOutOfCreditsModal` | boolean | Whether to display the modal |
| `modalDismissedAt` | number | Timestamp of last modal dismissal |
| `showLowCreditModal` | boolean | Whether low-credit warning is active |

### Selectors and Hooks

| Hook | Purpose |
|------|---------|
| `useIsOutOfCredits()` | Boolean check for credit exhaustion |
| `useShowOutOfCreditsModal()` | Whether modal should display (respects suppression) |
| `useCreditBalance()` | Current balance |
| `useUsagePercent()` | 0-100 usage percentage |

### justExhausted Signal

The `creditStatus` stream from Langgraph includes a `justExhausted` boolean. This is set to `true` when a graph run consumed the remaining credits (pre-run balance was positive but estimated post-run balance is at or below the buffer threshold). The frontend uses this to show the exhaustion modal immediately after the run that exhausted credits, rather than waiting for the next failed request.

## Related Docs

- [07-pre-run-authorization.md](./07-pre-run-authorization.md) - Pre-run check and 402 responses
- [06-credit-charging.md](./06-credit-charging.md) - How charges reduce the balance
- [03-credit-packs.md](./03-credit-packs.md) - Pack purchase flow (linked from modal buttons)
