# Plan: Subscribe First, Create Account Second

## Summary

Allow anonymous users to subscribe via Stripe Checkout before creating a Launch10 account. After payment, force account creation (email/password or Google OAuth), then sync the Stripe subscription to the new Account via the Pay gem.

## Approach: Direct Stripe Checkout + PendingSubscription table

We bypass the Pay gem for the initial checkout (since it requires an Account/Pay::Customer) and create the Stripe Checkout Session directly via the Stripe API. A `PendingSubscription` record tracks the checkout. After the user registers or logs in, we create the Pay::Customer, sync the subscription via `Pay::Stripe::Subscription.sync`, and credits are allocated through the existing `after_commit` callback.

**Why not a "skeleton Account" approach?** The Account model's `belongs_to :owner` plus dozens of callbacks/concerns that call `account.owner.email` (billing, webhooks, Atlas sync, etc.) would require nil-guards everywhere. Keeping the complexity isolated to a single new model + concern is cleaner.

## Flow

```
Pricing Page (anon) → Click "Subscribe"
  → AnonymousCheckoutsController#new (creates Stripe Checkout Session + PendingSubscription)
  → User pays in embedded Stripe Checkout
  → AnonymousCheckoutsController#show (marks PendingSubscription as paid, stores token in session)
  → Redirects to Sign Up (or Sign In)
  → User creates account or logs in
  → PendingSubscriptionSync concern syncs Stripe customer+subscription to Account
  → Credits allocated via existing PaySubscriptionCredits callback
```

## Implementation Steps

### 1. Migration: `create_pending_subscriptions`

```
pending_subscriptions
├── token (string, unique, not null) — session-safe identifier
├── stripe_checkout_session_id (string, indexed)
├── stripe_customer_id (string)
├── stripe_subscription_id (string, indexed)
├── stripe_customer_email (string, indexed) — for background email matching
├── plan_prefix_id (string, not null)
├── status (string, not null, default "pending") — pending/paid/claimed/expired
├── account_id (references accounts, nullable) — set when claimed
├── paid_at (datetime)
├── claimed_at (datetime)
├── expires_at (datetime, not null) — default 72 hours
├── timestamps
```

### 2. Model: `PendingSubscription`

- File: `app/models/pending_subscription.rb`
- `has_prefix_id :ps`
- `belongs_to :account, optional: true`
- Scopes: `pending`, `paid`, `unclaimed`, `claimable`
- Methods: `plan`, `paid!`, `claim!(account)`, `claimable?`
- Auto-generates `token` and `expires_at` on create

### 3. Controller: `AnonymousCheckoutsController`

- File: `app/controllers/anonymous_checkouts_controller.rb`
- `before_action :redirect_if_signed_in` (signed-in users go to normal checkout)
- **`new` action**: Creates `PendingSubscription` + `Stripe::Checkout::Session.create` directly (not Pay gem). Renders embedded Stripe Checkout using existing `subscriptions/forms/_stripe` partial (just needs `client_secret`).
- **`show` action** (return URL): Retrieves checkout session, updates PendingSubscription with `stripe_customer_id`, `stripe_subscription_id`, `stripe_customer_email`, marks as `paid`. Stores token in `session[:pending_subscription_token]`. Redirects to registration.

### 4. Route

Add to `config/routes.rb`:

```ruby
resource :anonymous_checkout, only: [:new], controller: "anonymous_checkouts" do
  get :return, action: :show, as: :return
end
```

### 5. View: `app/views/anonymous_checkouts/new.html.erb`

Minimal page rendering the Stripe embedded checkout. Reuses existing `subscriptions/forms/_stripe` partial and `subscriptions/new/testimonial` partial.

### 6. Concern: `PendingSubscriptionSync`

- File: `app/controllers/concerns/pending_subscription_sync.rb`
- `sync_pending_subscription_for(user)`:
  1. Finds PendingSubscription from `session[:pending_subscription_token]` or `params[:pending_subscription]`
  2. Checks `claimable?`
  3. Gets user's `owned_account`
  4. Calls `account.set_payment_processor(:stripe)` → updates `processor_id` to the Stripe customer ID
  5. Calls `Pay::Stripe::Subscription.sync(stripe_subscription_id)` → creates `Pay::Subscription` → triggers `after_commit on: :create` → credits allocated
  6. Calls `pending.claim!(account)`
  7. Clears session token
- Rescue: on failure, enqueues `SyncPendingSubscriptionWorker` for retry
- Also handles edge case: if account already has a different Stripe customer or already subscribed

### 7. Modify `Users::RegistrationsController`

- File: `app/controllers/users/registrations_controller.rb`
- Add `include PendingSubscriptionSync`
- In `sign_up` method (line 76), call `sync_pending_subscription_for(resource)` after `super`
- Add `has_pending_subscription` to `inertia_share` so the SignUp page can show a banner

### 8. Modify `Users::SessionsController`

- File: `app/controllers/users/sessions_controller.rb`
- Add `include PendingSubscriptionSync`
- In `after_sign_in_path_for` (line 72), call `sync_pending_subscription_for(resource)` if session token present

### 9. Modify `Users::OmniauthCallbacksController`

- File: `app/controllers/users/omniauth_callbacks_controller.rb`
- Add `include PendingSubscriptionSync`
- Override `after_sign_in_path_for` to call `sync_pending_subscription_for(resource)` if session token present

### 10. Modify pricing helper

- File: `app/helpers/subscriptions_helper.rb`
- Change `pricing_link_to` to route anonymous users to `new_anonymous_checkout_path(plan: plan)` instead of `new_subscription_path`

### 11. Fix `Credits::PlanChangeHandler`

- File: `app/webhooks/credits/plan_change_handler.rb` (line 25)
- Change `raise "Subscription not found..."` to `return` with a warning log
- The subscription may not exist yet during the anonymous checkout window

### 12. Background worker: `SyncPendingSubscriptionWorker`

- File: `app/workers/sync_pending_subscription_worker.rb`
- Retries failed syncs from the concern's rescue block
- Also used by cleanup worker for email-based matching

### 13. Background worker: `CleanupPendingSubscriptionsWorker`

- File: `app/workers/cleanup_pending_subscriptions_worker.rb`
- Runs hourly via Zhong
- Expires old `pending` records past `expires_at`
- Matches unclaimed `paid` records by email to existing users

### 14. Frontend changes

- **SignUp.tsx**: Show "Payment received! Create your account to get started." banner when `has_pending_subscription` is true
- **SignUp.tsx / SignIn.tsx**: Preserve `pending_subscription` token in links between sign-up and sign-in pages

## Files Modified

| File                                                     | Change                                                 |
| -------------------------------------------------------- | ------------------------------------------------------ |
| `db/migrate/xxx_create_pending_subscriptions.rb`         | **New** — migration                                    |
| `app/models/pending_subscription.rb`                     | **New** — model                                        |
| `app/controllers/anonymous_checkouts_controller.rb`      | **New** — controller                                   |
| `app/views/anonymous_checkouts/new.html.erb`             | **New** — checkout page                                |
| `app/controllers/concerns/pending_subscription_sync.rb`  | **New** — shared sync concern                          |
| `app/workers/sync_pending_subscription_worker.rb`        | **New** — retry/email-match worker                     |
| `app/workers/cleanup_pending_subscriptions_worker.rb`    | **New** — hourly cleanup                               |
| `config/routes.rb`                                       | Add anonymous_checkout route                           |
| `app/helpers/subscriptions_helper.rb`                    | Route anon users to anonymous checkout                 |
| `app/controllers/users/registrations_controller.rb`      | Include concern, call sync in `sign_up`                |
| `app/controllers/users/sessions_controller.rb`           | Include concern, call sync in `after_sign_in_path_for` |
| `app/controllers/users/omniauth_callbacks_controller.rb` | Include concern, override `after_sign_in_path_for`     |
| `app/webhooks/credits/plan_change_handler.rb`            | Soften `raise` to `return` for missing subscriptions   |
| `app/javascript/frontend/pages/Auth/SignUp.tsx`          | Add pending subscription banner                        |
| `app/javascript/frontend/pages/Auth/SignIn.tsx`          | Preserve token in sign-up link                         |

## Edge Cases Handled

- **Email mismatch** (Stripe email A, register email B): Primary linking is session-token-based, not email. Email matching is a background fallback only.
- **User already subscribed**: Check before sync; cancel the anonymous subscription if duplicate.
- **Webhook timing**: Stripe webhooks fire before Pay::Customer exists. All handlers already return nil for unknown customers except `PlanChangeHandler` which needs the fix in step 11.
- **Session loss**: Token also passed as URL param. Google OAuth preserves Rails session across redirect. Background email matching is the ultimate fallback.
- **Abandoned checkout**: Subscription stays active in Stripe. When user eventually registers with that email, background job links it.

## Verification

1. **Manual test — anonymous subscribe + register**: Visit `/pricing` while logged out → click subscribe → complete Stripe Checkout → verify redirect to sign-up → create account → verify subscription is active on account → verify credits allocated
2. **Manual test — anonymous subscribe + login**: Same flow but click "Sign In" instead → log in with existing account → verify subscription synced
3. **Manual test — Google OAuth**: Same flow but use Google OAuth after checkout → verify subscription synced
4. **Webhook test**: Check Rails logs during checkout to confirm Stripe webhooks for unknown customers don't error (especially `PlanChangeHandler`)
5. **Run existing tests**: `bundle exec rspec spec/integration/credits/` and `bundle exec ruby -Itest test/controllers/users/registrations_controller_test.rb`
6. **New tests**: Add request specs for `AnonymousCheckoutsController`, unit tests for `PendingSubscription` model, and integration test for the full subscribe-then-register flow
