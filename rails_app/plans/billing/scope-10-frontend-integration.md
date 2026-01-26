# Scope 10: Frontend Integration (Balance Display & Packs)

## Overview

**Purpose**: Show users their credit balance, transaction history, and enable pack purchases.

**Dependencies**: Scope 9 (Credit Exhaustion Detection) should be completed first.

---

## Deliverables

### API Endpoints

#### 1. `GET /api/v1/credits` - Detailed balance breakdown

**File**: `app/controllers/api/v1/credits_controller.rb` (extend)

```json
{
  "total_credits": 4500,
  "plan_credits": 4000,
  "pack_credits": 500,
  "plan_credits_allocated": 5000,
  "usage_percent": 20,
  "next_reset_at": "2026-02-15T00:00:00Z"
}
```

#### 2. `GET /api/v1/credits/transactions` - Paginated history

- **Filters**: `type`, `date_range`
- **Pagination**: cursor-based
- **Returns**: transaction type, amount, reason, created_at, metadata

```json
{
  "transactions": [
    {
      "id": "ct_123",
      "transaction_type": "consume",
      "credit_type": "plan",
      "reason": "ai_generation",
      "amount": -150,
      "balance_after": 4350,
      "created_at": "2026-01-25T10:30:00Z",
      "metadata": {
        "chat_id": 456,
        "run_id": "run_abc123"
      }
    }
  ],
  "cursor": "eyJpZCI6MTIzfQ==",
  "has_more": true
}
```

#### 3. `GET /api/v1/credit_packs` - Available packs for purchase

**File**: `app/controllers/api/v1/credit_packs_controller.rb` (create)

```json
{
  "packs": [
    {
      "id": "cp_1",
      "name": "Starter Pack",
      "credits": 500,
      "price_cents": 500,
      "price_display": "$5.00",
      "credits_per_dollar": 100
    },
    {
      "id": "cp_2",
      "name": "Pro Pack",
      "credits": 2500,
      "price_cents": 2000,
      "price_display": "$20.00",
      "credits_per_dollar": 125
    }
  ]
}
```

#### 4. `POST /api/v1/credit_packs/:id/purchase` - Initiate purchase

Creates Stripe checkout session for pack.

**Request**:
```json
{
  "success_url": "/settings/credits?purchased=true",
  "cancel_url": "/settings/credits"
}
```

**Response**:
```json
{
  "checkout_url": "https://checkout.stripe.com/...",
  "session_id": "cs_..."
}
```

---

### React Components

#### 5. `CreditBalanceDisplay` - Header/sidebar widget

**File**: `app/javascript/frontend/components/credits/CreditBalanceDisplay.tsx`

- Shows total credits with plan/pack breakdown
- Visual indicator (progress bar or gauge)
- Color coding: green (>50%), yellow (20-50%), red (<20%)
- Link to full credits page

```tsx
interface CreditBalanceDisplayProps {
  variant?: "compact" | "full";  // compact for header, full for settings
  showBreakdown?: boolean;
}
```

#### 6. `CreditUsageChart` - Dashboard visualization

**File**: `app/javascript/frontend/components/credits/CreditUsageChart.tsx`

- Credits used over time (line chart)
- Current period usage vs allocation (donut/bar)
- Uses recharts or similar

#### 7. `TransactionHistory` - Paginated table

**File**: `app/javascript/frontend/components/credits/TransactionHistory.tsx`

- Type icons/badges (allocate, consume, purchase, gift, expire)
- Human-readable reasons
- Sortable by date
- Filterable by type
- Infinite scroll or pagination

```tsx
interface TransactionHistoryProps {
  accountId: string;
  pageSize?: number;
  filterType?: TransactionType;
}
```

#### 8. `CreditPackPurchaseCard` - Purchase UI

**File**: `app/javascript/frontend/components/credits/CreditPackPurchaseCard.tsx`

- Pack options with pricing
- Highlight best value
- "Buy Now" button → Stripe checkout
- Requires active subscription (show message if not subscribed)

#### 9. `LowCreditWarning` - Alert component

**File**: `app/javascript/frontend/components/credits/LowCreditWarning.tsx`

- Shown when usage > 80% (configurable threshold)
- Dismissable with "Don't show again this session" option
- Link to purchase packs
- Can be placed in header or as banner

```tsx
interface LowCreditWarningProps {
  threshold?: number;  // default 80
  variant?: "banner" | "toast";
}
```

---

### Pages

#### 10. `/settings/credits` - Credits management page

**File**: `app/javascript/frontend/pages/settings/Credits.tsx`

Layout:
```
┌─────────────────────────────────────────────────────┐
│ Credits                                              │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────┐  ┌────────────────────────┐ │
│ │  Current Balance    │  │  This Period           │ │
│ │  4,500 credits      │  │  ████████░░ 20% used   │ │
│ │  Plan: 4,000        │  │  Resets: Feb 15        │ │
│ │  Pack: 500          │  │                        │ │
│ └─────────────────────┘  └────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ Purchase Credit Packs                                │
│ ┌────────┐ ┌────────┐ ┌────────┐                   │
│ │ 500    │ │ 2,500  │ │ 10,000 │                   │
│ │ $5     │ │ $20    │ │ $75    │                   │
│ │ [Buy]  │ │ [Buy]  │ │ [Buy]  │                   │
│ └────────┘ └────────┘ └────────┘                   │
├─────────────────────────────────────────────────────┤
│ Transaction History                                  │
│ ┌───────────────────────────────────────────────┐   │
│ │ Date       │ Type    │ Amount │ Balance       │   │
│ │ Jan 25     │ Consume │ -150   │ 4,350         │   │
│ │ Jan 24     │ Consume │ -200   │ 4,500         │   │
│ │ Jan 20     │ Allocate│ +5,000 │ 4,700         │   │
│ └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `app/controllers/api/v1/credits_controller.rb` | Extend (balance, transactions) |
| `app/controllers/api/v1/credit_packs_controller.rb` | Create |
| `config/routes/api.rb` | Add routes |
| `app/javascript/frontend/components/credits/CreditBalanceDisplay.tsx` | Create |
| `app/javascript/frontend/components/credits/TransactionHistory.tsx` | Create |
| `app/javascript/frontend/components/credits/CreditPackPurchaseCard.tsx` | Create |
| `app/javascript/frontend/components/credits/CreditUsageChart.tsx` | Create |
| `app/javascript/frontend/components/credits/LowCreditWarning.tsx` | Create |
| `app/javascript/frontend/pages/settings/Credits.tsx` | Create |
| `app/javascript/frontend/hooks/useCredits.ts` | Create (data fetching) |

---

## Tests

### Rails

```
spec/requests/api/v1/credits_spec.rb
  - GET /credits returns balance breakdown
  - GET /credits returns usage_percent correctly
  - GET /credits returns next_reset_at for subscribed users
  - GET /credits/transactions returns paginated history
  - GET /credits/transactions filters by type
  - GET /credits/transactions filters by date range
  - GET /credits/transactions respects cursor pagination

spec/requests/api/v1/credit_packs_spec.rb
  - GET /credit_packs returns available packs
  - GET /credit_packs only returns visible packs
  - POST /credit_packs/:id/purchase creates checkout session
  - POST /credit_packs/:id/purchase requires active subscription
  - POST /credit_packs/:id/purchase returns error for invalid pack
```

### Frontend

```
components/credits/CreditBalanceDisplay.test.tsx
  - renders total credits
  - shows plan/pack breakdown when showBreakdown=true
  - displays correct color based on usage level
  - links to credits page

components/credits/TransactionHistory.test.tsx
  - renders transaction list
  - displays type icons correctly
  - formats amounts (positive/negative)
  - handles pagination

components/credits/CreditPackPurchaseCard.test.tsx
  - renders pack options
  - highlights best value pack
  - calls purchase API on click
  - shows subscription required message when appropriate

components/credits/LowCreditWarning.test.tsx
  - shows at 80% threshold
  - hides when dismissed
  - links to credits page
```

---

## Verification Strategy

### Unit Tests

1. `/credits` endpoint returns full breakdown
2. `/credits/transactions` pagination works
3. `/credit_packs` lists available packs
4. `/credit_packs/:id/purchase` creates checkout session

### Component Tests

1. `CreditBalanceDisplay` shows correct values
2. `TransactionHistory` renders and filters
3. `LowCreditWarning` appears at 80% threshold

### E2E Test

1. Navigate to credits page → see balance
2. Click "Buy" on credit pack → redirect to Stripe checkout
3. Complete purchase → return to credits page → balance increased

---

## Implementation Phases

| Phase | Task | Duration |
|-------|------|----------|
| 1 | Balance display UI and `/credits` API | 1 day |
| 2 | Transaction history API and component | 1 day |
| 3 | Credit pack purchase UI and API | 1 day |
| 4 | Low credit warning (80%) | 0.5 day |
| **Total** | | **~3.5 days** |

---

## Design Notes

### Credit Display Format

- Always show credits as integers (millicredits are internal only)
- Format large numbers with commas: `4,500 credits`
- Show plan vs pack breakdown: `Plan: 4,000 | Pack: 500`

### Transaction Type Icons

| Type | Icon | Color |
|------|------|-------|
| allocate | Plus circle | Green |
| consume | Minus circle | Red |
| purchase | Credit card | Blue |
| gift | Gift | Purple |
| expire | Clock | Gray |
| refund | Arrow left | Green |
| adjust | Sliders | Orange |

### Warning Thresholds

- 80%+ usage: Show yellow warning
- 100% usage: Show red warning (handled by Scope 9 exhaustion modal)
