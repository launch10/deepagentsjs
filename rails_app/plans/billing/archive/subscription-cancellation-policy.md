# Subscription Cancellation Credits Policy

## Policy Summary

When a user cancels their subscription, the following rules apply to their credits:

### Plan Credits

- **During grace period**: User retains full access to plan credits until the billing period ends
- **After subscription ends**: Plan credits remain in the account but no new credits are ever granted
- **No monthly resets**: Yearly subscribers with pending cancellation do not receive monthly credit resets
- **No renewal allocations**: Canceled subscriptions are skipped by the renewal handler

### Pack Credits

- **Never affected by subscription status**: Pack credits purchased are owned by the user permanently
- **No expiration**: Even after subscription cancellation, pack credits remain usable
- **Can be used without subscription**: Users with pack credits can still use AI features even without an active subscription

## Current Implementation Status

### Implemented

- Graceful cancellation preserves credits until period end
- Pack credits are preserved during all subscription operations
- Renewals and plan changes properly manage credits
- Webhook handler for `stripe.customer.subscription.deleted` (no-op for credits)
- `DailyReconciliationWorker` excludes subscriptions with `ends_at` set (pending cancellation)
- `RenewalHandler` skips inactive subscriptions (no renewal after cancellation)

## How Cancellation Protection Works

There is no single "expire credits" action. Instead, cancellation is enforced by **preventing new credit grants**:

1. **`CancellationHandler`** (`app/webhooks/credits/cancellation_handler.rb`):
   Registered for `stripe.customer.subscription.deleted`. Intentionally a no-op for credits.
   The user keeps their remaining balance — they already paid for the current period.

2. **`RenewalHandler`** (`app/webhooks/credits/renewal_handler.rb`):
   Checks `subscription.active?` before allocating. Canceled subscriptions are skipped,
   so no new monthly credits are granted after cancellation.

3. **`DailyReconciliationWorker`** (`app/workers/credits/daily_reconciliation_worker.rb`):
   Filters `where(ends_at: nil)` to exclude subscriptions pending cancellation.
   This prevents yearly subscribers from receiving monthly credit resets after they cancel.

## Test Cases

1. **User cancels subscription**: Plan credits remain until used (no immediate expiration)
2. **Subscription period ends (subscription.deleted)**: Credits remain, no new ones granted
3. **Yearly subscriber cancels**: No monthly credit resets via DailyReconciliationWorker
4. **Renewal webhook for canceled subscription**: Ignored (subscription not active)
5. **User has pack credits**: Pack credits remain unaffected by cancellation
6. **User with only pack credits**: Can still use AI features without active subscription

## Edge Cases

### Reactivation After Cancellation

- If user resubscribes within the same billing period: No change (still had credits)
- If user resubscribes after period ends: Fresh allocation on new subscription creation

### Pause vs Cancel

- **Pause**: Not currently supported by Stripe integration
- **Cancel**: Full policy above applies

### Immediate Cancellation (cancel_now)

- Same as period-end cancellation for credits
- Credits remain in the account, no new grants

## Related Files

- `app/webhooks/credits/cancellation_handler.rb` - No-op handler for subscription.deleted
- `app/webhooks/credits/renewal_handler.rb` - Handles credit allocation on renewal (skips canceled)
- `app/webhooks/credits/plan_change_handler.rb` - Handles up/downgrade credit adjustments
- `app/workers/credits/daily_reconciliation_worker.rb` - Monthly resets for yearly subs (excludes canceled)
- `app/services/credits/consumption_service.rb` - Service for consuming credits
- `config/initializers/pay.rb` - Webhook registration
- `spec/integration/credits/subscription_lifecycle_spec.rb` - Integration tests for full lifecycle
- `spec/workers/credits/daily_reconciliation_worker_spec.rb` - Daily reconciliation tests
