---
status: approved
approved_date: 2025-01-08
reviewers:
  - dhh-rails-reviewer
  - kieran-rails-reviewer
  - code-simplicity-reviewer
priority: phase-1c
depends_on:
  - environment-variables.md
---

# Email Lead Capture - Rails Backend Plan

## Overview

Public API endpoint for landing pages to submit email signups. Uses Rails `signed_id` for stateless, tamper-proof authentication.

**Related plans:**

- `plans/email-backend-coding-agent.md` - Agent guidance for using the API
- `plans/environment-variables.md` - Stores VITE_SIGNUP_TOKEN for build-time injection

**Dependency:** This plan depends on `environment-variables.md` being implemented first.

---

## Part 1: Database Migration

**Migration: Create leads table**

```ruby
# db/migrate/xxx_create_leads.rb
create_table :leads do |t|
  t.references :project, null: false, foreign_key: true
  t.string :email, null: false, limit: 255
  t.string :name
  t.timestamps
end

add_index :leads, [:project_id, :email], unique: true
```

No token storage needed - `signed_id` derives tokens from the project ID and Rails' `secret_key_base`.

---

## Part 2: Models

**Lead model** (`app/models/lead.rb`)

```ruby
class Lead < ApplicationRecord
  belongs_to :project

  validates :email, presence: true,
                    length: { maximum: 255 },
                    format: { with: URI::MailTo::EMAIL_REGEXP },
                    uniqueness: { scope: :project_id, case_sensitive: false }
  validates :name, length: { maximum: 255 }, allow_blank: true

  before_validation :normalize_email

  private

  def normalize_email
    self.email = email&.downcase&.strip
  end

  # Class method for normalizing email before queries
  def self.normalize_email(email)
    email&.downcase&.strip
  end
end
```

**Project model updates** (`app/models/project.rb`)

```ruby
class Project < ApplicationRecord
  has_many :leads, dependent: :destroy

  def signup_token
    signed_id(purpose: :lead_signup)
  end
end
```

### Why signed_id Instead of JWT

| Aspect            | JWT (Original)          | signed_id (Updated)    |
| ----------------- | ----------------------- | ---------------------- |
| Dependencies      | `jwt` gem               | Built into Rails       |
| Storage           | Store token in DB       | Nothing to store       |
| Code              | ~20 lines encode/decode | 1 line                 |
| Secret management | Manual `jwt_secret`     | Uses `secret_key_base` |
| Revocation        | Regenerate & store      | See below              |

**Revocation (if needed later):** Add `signup_token_version` column and include in purpose:

```ruby
def signup_token
  signed_id(purpose: [:lead_signup, signup_token_version])
end

def revoke_signup_token!
  increment!(:signup_token_version)
end
```

### Integration with EnvironmentVariable

The `signup_token` is stored as an `EnvironmentVariable` so it gets injected into deployed websites:

```ruby
# In Project after_create callback (from environment-variables.md)
after_create :seed_system_environment_variables

def seed_system_environment_variables
  set_env_var("VITE_SIGNUP_TOKEN", signup_token, system: true,
              description: "Authenticates lead capture API calls")
  set_env_var("VITE_API_BASE_URL", Rails.configuration.api_base_url, system: true,
              description: "Base URL for API calls from deployed sites")
end
```

**Flow:**

1. Project created → `after_create` stores `VITE_SIGNUP_TOKEN` in EnvironmentVariable
2. Website deployed → `buildable.rb` writes `.env` file with token
3. Vite embeds token in JS bundle
4. Landing page calls `/api/v1/leads?token=<embedded_token>`
5. Rails validates via `Project.find_signed!(token, purpose: :lead_signup)`

---

## Part 3: Public API Endpoint

**Controller** (`app/controllers/api/v1/leads_controller.rb`)

```ruby
# Public endpoint - no authentication required
# Token validation via signed_id, not session/JWT
class API::V1::LeadsController < ActionController::API
  def create
    project = Project.find_signed!(params[:token], purpose: :lead_signup)

    normalized_email = Lead.normalize_email(lead_params[:email])

    # Already captured - acknowledge and move on (no updates to existing leads)
    return render json: { success: true }, status: :ok if project.leads.exists?(email: normalized_email)

    lead = project.leads.new(lead_params)
    if lead.save
      render json: { success: true }, status: :created
    else
      render json: { errors: lead.errors }, status: :unprocessable_entity
    end
  rescue ActiveSupport::MessageVerifier::InvalidSignature, ActiveRecord::RecordNotFound
    render json: { error: "Invalid token" }, status: :unauthorized
  end

  private

  def lead_params
    params.permit(:email, :name)
  end
end
```

### Why `ActionController::API` instead of `API::BaseController`?

| Aspect         | `API::BaseController`               | `ActionController::API` |
| -------------- | ----------------------------------- | ----------------------- |
| Authentication | ✓ JWT/API token validation          | ✗ None                  |
| Authorization  | ✓ `current_account`, `current_user` | ✗ None                  |
| Includes       | Cookies, caching, locale, Pundit    | Bare minimum            |
| Use case       | Internal APIs for logged-in users   | Public endpoints        |

**Why this matters for leads:**

- The endpoint is **fully public** - no user is logged in
- The `signed_id` token identifies the project directly (`Project.find_signed!`)
- We don't need account scoping - the token is the authorization
- Inheriting from `API::BaseController` would require `skip_before_action :require_api_authentication` and drag in unused machinery

**Route** (`config/routes/api.rb`)

```ruby
resources :leads, only: [:create]  # POST /api/v1/leads
```

---

## Part 4: CORS Configuration

### Why CORS is needed for this endpoint (but not others)

**CORS (Cross-Origin Resource Sharing)** is a browser security feature that blocks JavaScript from making requests to a different domain than the page was loaded from.

| Caller                        | API Endpoint               | Same Origin?     | CORS Needed? |
| ----------------------------- | -------------------------- | ---------------- | ------------ |
| `launch10.com` React frontend  | `launch10.com/api/v1/*`     | ✓ Yes            | No           |
| Langgraph service (server)    | `launch10.com/api/v1/*`     | N/A (no browser) | No           |
| `cool-startup.launch10.dev`   | `launch10.com/api/v1/leads` | ✗ No             | **Yes**      |
| `my-idea.com` (custom domain) | `launch10.com/api/v1/leads` | ✗ No             | **Yes**      |

Our existing APIs are called from the same origin (our React frontend) or server-to-server (Langgraph). The leads endpoint is unique - it's called from deployed landing pages on different domains.

### Implementation

Add `rack-cors` gem and create initializer:

**Gemfile**

```ruby
gem "rack-cors"
```

**`config/initializers/cors.rb`**

```ruby
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "*"
    resource "/api/v1/leads",
      headers: ["Content-Type"],
      methods: [:post, :options],
      credentials: false,  # Explicit: no cookies sent
      max_age: 600
  end
end
```

**Note:** This config is scoped to only `/api/v1/leads`. All other APIs remain same-origin only - no security change for authenticated endpoints.

---

## Part 5: Token Regeneration Behavior

**Important limitation:** If token revocation is implemented later (via `signup_token_version`), already-deployed pages will have the old token baked in.

Options:

1. **Accept limitation** - old deploys stop working (user must redeploy)
2. **Auto-redeploy** when token regenerates
3. **Store multiple valid token versions** (adds complexity)

For MVP, option 1 is acceptable. Document for users that regenerating tokens requires redeployment.

---

## Files to Modify/Create

| File                                         | Action                                                |
| -------------------------------------------- | ----------------------------------------------------- |
| `Gemfile`                                    | Add `rack-cors` gem                                   |
| `db/migrate/xxx_create_leads.rb`             | Create                                                |
| `app/models/lead.rb`                         | Create                                                |
| `app/models/project.rb`                      | Modify (add `has_many :leads`, `signup_token` method) |
| `app/controllers/api/v1/leads_controller.rb` | Create                                                |
| `config/routes/api.rb`                       | Modify (add leads route)                              |
| `config/initializers/cors.rb`                | Create                                                |

---

## Implementation Order

1. Add `rack-cors` gem, bundle install
2. Create migration, run it
3. Create Lead model
4. Update Project model
5. Create leads controller
6. Add route
7. Create CORS initializer
8. Test manually, then add specs

---

## Verification Plan

1. Unit tests: Lead model validations, email normalization
2. Request spec: POST /api/v1/leads with valid/invalid tokens
3. Manual test:
   - Create a project in console
   - Get its `signup_token`
   - POST to `/api/v1/leads` with token and email
   - Verify lead created

---

## Security Considerations

- Tokens are cryptographically signed using Rails' `secret_key_base`
- Tokens are purpose-scoped (`:lead_signup`) - can't be used for other operations
- Rate limiting handled at Cloudflare layer
- Email validation and normalization prevents injection and duplicates
- CORS allows all origins but only POST to /api/v1/leads
- No PII beyond email/name stored
- Tokens never expire by design (deployed pages need persistent access); revocation via version increment (future)
- RecordNotFound errors return 401 (not 404) to avoid leaking project existence

---

## Decision: No Origin Header Validation

**Date:** 2025-01-08

**Context:** Considered adding a `before_action` to validate the `Origin` header against the project's deployed website URLs (via `website_urls` table) to prevent token abuse from unauthorized origins.

**Decision:** Do NOT implement origin validation.

**Why origin validation is security theater for this endpoint:**

1. **Non-browser clients bypass it trivially** - Attackers can set any Origin header:

   ```bash
   curl -H "Origin: https://legitimate-site.launch10.site" -X POST ...
   ```

2. **The threat model is token theft** - If someone extracts the token from page source or network inspection, they can submit leads from anywhere. Origin validation only stops the laziest attackers who don't bother spoofing headers.

3. **Browser behavior is inconsistent** - Some browsers, proxies, and privacy extensions strip or modify Origin headers. Legitimate requests could fail.

4. **Breaks legitimate use cases** - API testing tools (Postman, curl), debugging, and any non-browser integrations would fail.

**Proper mitigations for token abuse (already in place or planned):**

| Mitigation       | Status                     | Effect                         |
| ---------------- | -------------------------- | ------------------------------ |
| Rate limiting    | ✓ Cloudflare layer         | Prevents bulk abuse            |
| Token revocation | Future (version increment) | Invalidates compromised tokens |
| Monitoring       | Future                     | Detect anomalous lead patterns |

**Trade-offs accepted:**

- Anyone with the token can submit leads from any origin
- This is acceptable because the token IS the authorization - it's designed to be embedded in public pages

**Status:** Current
