# Settings Page Implementation

## Overview

This document describes the implementation of the Settings page for Launch10, providing users with account management capabilities including profile editing, billing/credits overview, and subscription management.

## Goals

1. **Profile Management**: Allow users to view and edit their profile information (name)
2. **Billing & Credits**: Display credit usage, provide access to Stripe customer portal for payment management
3. **Subscription Management**: Show current plan details, features, and provide subscription cancellation flow

## Architecture

### Backend

**Controller**: `SettingsController` (inherits from `SubscribedController`)

- Requires active subscription (inherited from `SubscribedController`)
- `GET /settings` - renders Settings page with props
- `PATCH /settings` - updates user profile (first_name, last_name)

**Props Structure**:

```ruby
{
  user: { id, email, name, first_name, last_name },
  credit_balance: {
    plan_credits, pack_credits, total_credits,
    plan_credit_limit, reset_date
  },
  subscription: {
    id, status, plan_name, plan_display_name,
    interval, amount_cents, currency,
    current_period_start, current_period_end, features
  },
  billing_history: [{ id, amount_cents, currency, description, created_at, type }],
  stripe_portal_url: "https://..."
}
```

**Data Sources**:

- User profile: `current_user`
- Credits: `current_account.plan_credits`, `pack_credits`, `total_credits`
- Subscription: `current_account.subscriptions.active.first` + associated `Plan`
- Billing history: `Pay::Charge` records from payment processor
- Stripe portal: `payment_processor.billing_portal`

### Frontend

**Page**: `app/javascript/frontend/pages/Settings.tsx`

- Main layout with IBM Plex Serif title "Account Settings"
- Max-width 911px, background #FAFAF9

**Components** (in `app/javascript/frontend/components/settings/`):

| Component                 | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `ProfileSection`          | Display/edit user name, show email (read-only), password change link    |
| `BillingCreditsSection`   | Credit usage progress bar, Purchase Credits button, Stripe portal links |
| `SubscriptionSection`     | Current plan display, features list, Cancel/Change Plan buttons         |
| `CancelSubscriptionModal` | Confirmation modal for subscription cancellation                        |

### Type Safety

- RSwag schema: `spec/support/schemas/inertia/settings_schema.rb`
- Generated OpenAPI: `swagger/v1/inertia-props.yaml`
- TypeScript types: `shared/lib/api/generated/inertia-props.ts`
- Page props type: `InertiaProps.paths["/settings"]["get"]["responses"]["200"]["content"]["application/json"]`

## UI Design (Figma Alignment)

### Typography

| Element        | Font              | Size | Weight | Color   |
| -------------- | ----------------- | ---- | ------ | ------- |
| Page title     | IBM Plex Serif    | 28px | 600    | #2E3238 |
| Section titles | Plus Jakarta Sans | 18px | 600    | #2E3238 |
| Labels         | Plus Jakarta Sans | 14px | 600    | #2E3238 |
| Body text      | Plus Jakarta Sans | 14px | 400    | #74767A |

### Colors

| Token              | Hex     | Usage                    |
| ------------------ | ------- | ------------------------ |
| Base/600           | #0F1113 | Primary text             |
| Base/500           | #2E3238 | Secondary text, buttons  |
| Primary/600        | #3748B8 | Purchase Credits button  |
| Error/500          | #D14F34 | Cancel subscription text |
| Success/500        | #2E9E72 | Feature checkmarks       |
| Neutral/300        | #D3D2D0 | Card borders             |
| Neutral/Background | #FAFAF9 | Page background          |

### Component Styling

- Cards: `rounded-2xl`, `border-[#D3D2D0]`
- Progress bar: 14px height (#3748B8 fill)
- Buttons: 44px height, 8px border-radius
- Modal: 600px width, 8px border-radius, custom shadow

## User Flows

### Edit Profile

1. User clicks "Edit" button (pencil icon)
2. Name input becomes editable
3. Save/Cancel buttons appear inline
4. On save: PATCH /settings with form data
5. On success: Exit edit mode, show updated name

### Cancel Subscription

1. User clicks "Cancel Subscription" in subscription section
2. Modal opens with period end date information
3. User can "Keep Subscription" (closes modal) or "Confirm Cancellation"
4. Confirm Cancellation: Redirects to Stripe customer portal (stubbed for now)

### Purchase Credits

1. User clicks "Purchase Credits" button
2. Action stubbed - will redirect to Stripe customer portal in future work

### Stripe Portal Actions

- Update Payment Method → Stripe customer portal
- View Billing History → Stripe customer portal
- Change Plan → Stripe customer portal (stubbed)

## Testing

### RSwag Specs (`spec/requests/inertia/settings_spec.rb`)

- Schema validation for all props
- Subscribed user happy path
- Non-subscribed user (redirected to pricing)
- Unauthenticated user (redirected to login)
- Billing history from Pay::Charge
- Profile update (PATCH)

### E2E Tests (`e2e/settings.spec.ts`)

- Profile information display
- Credit balance display
- Subscription information and features
- Edit profile flow
- Cancel subscription modal open/close
- Stripe portal links visibility
- Three-section layout verification

## Future Work

1. **BuyCreditsModal**: Credit pack selection UI (removed from current scope)
2. **Stripe Integration**: Wire up stubbed actions to actual Stripe customer portal
3. **Additional edge cases**: Past due subscriptions, multiple subscriptions

## Files Changed

### New Files

- `app/controllers/settings_controller.rb`
- `app/javascript/frontend/pages/Settings.tsx`
- `app/javascript/frontend/components/settings/*.tsx` (5 files)
- `app/javascript/frontend/components/ui/dialog.tsx`
- `app/javascript/frontend/components/ui/progress.tsx`
- `spec/requests/inertia/settings_spec.rb`
- `spec/support/schemas/inertia/settings_schema.rb`
- `e2e/settings.spec.ts`

### Modified Files

- `config/routes/subscribed.rb` - added settings route
- `lib/tasks/inertia.rake` - added Settings schema to generator
- `swagger/v1/inertia-props.yaml` - generated
- `shared/lib/api/generated/inertia-props.ts` - generated

## Related Documentation

- [Figma Design System](https://figma.com/...) - Launch10 Design System
- [Jumpstart Pro Docs](https://jumpstartrails.com/docs) - Pay gem integration
- [Inertia.js](https://inertiajs.com/) - Frontend/backend integration
