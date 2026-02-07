# Google Account Connect

Before deploying ads, users must connect their Google account and accept an invitation to a managed Google Ads sub-account. The flow is: **OAuth connect → create sub-account → send invitation → poll for acceptance → verify billing**.

## Flow

```
User clicks "Connect Google"
       │
       ▼
Omniauth OAuth2 (google_oauth2 provider)
       │  stores ConnectedAccount (email, tokens)
       ▼
Deploy graph triggers ConnectingGoogle task
       │
       ▼
SendInviteWorker
  1. Create AdsAccount (google platform) if needed
  2. Sync to Google (creates sub-account under MCC)
  3. Send invitation email to user's Google email
       │
       ▼
PollInviteAcceptanceWorker
  ├─ Check every few seconds for 30 minutes
  ├─ Query Google API for invitation status
  └─ On acceptance → complete JobRun → webhook to Langgraph
       │
       ▼
Deploy graph triggers VerifyingGoogle task
       │
       ▼
PaymentCheckWorker
  ├─ Fetch billing status from Google
  └─ Return has_payment boolean → webhook to Langgraph
```

## Models

**AdsAccount** (`rails_app/app/models/ads_account.rb`):
- Stores `google.customer_id`, `google.billing_status`, `google.conversion_action_resource_name`
- Methods: `send_google_ads_invitation_email()`, `google_billing_enabled?()`, `google_send_to()`

**AdsAccountInvitation** (`rails_app/app/models/ads_account_invitation.rb`):
- Tracks invitation lifecycle: `pending → sent → accepted` (or `declined`/`expired`)
- Stores `google.invitation_id`, `google.access_role`, `google.accepted_at`

## Status API

Three endpoints for frontend polling:

| Endpoint | Returns |
|----------|---------|
| `GET /api/v1/google/connection_status` | `{ connected, email }` |
| `GET /api/v1/google/invite_status` | `{ accepted, status }` |
| `GET /api/v1/google/payment_status` | `{ has_payment }` |

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/models/ads_account.rb` | Google Ads sub-account |
| `rails_app/app/models/ads_account_invitation.rb` | Invitation tracking |
| `rails_app/app/models/concerns/account_concerns/google_ads_account.rb` | Account-level helpers |
| `rails_app/app/services/google_ads/resources/account_invitation.rb` | Invitation API sync |
| `rails_app/app/workers/google_ads/send_invite_worker.rb` | Creates account + sends invite |
| `rails_app/app/workers/google_ads/poll_invite_acceptance_worker.rb` | Polls for acceptance (30 min timeout) |
| `rails_app/app/workers/google_ads/payment_check_worker.rb` | Verifies billing setup |
| `rails_app/app/controllers/api/v1/google_controller.rb` | Status polling endpoints |

## Gotchas

- **30-minute timeout**: The invite poll worker gives up after 30 minutes. If the user accepts later, the deploy must be re-triggered.
- **MCC structure**: All user accounts are sub-accounts under Launch10's MCC (Manager account). The `login_customer_id` in API config is the MCC ID.
- **Billing URL**: Users must set up billing themselves at `https://ads.google.com/aw/billing/setup?ocid=<customer_id>`. We can only check the status, not set it up programmatically.
- **Conversion tracking**: After account setup, a conversion action is created and its `conversion_id` + `conversion_label` are stored for gtag injection during website deploys.
