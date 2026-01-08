# Email Lead Capture Implementation Plan

## Overview

Public API endpoint for landing pages to submit email signups. Uses Rails `signed_id` for stateless, tamper-proof authentication.

---

## Part 1: Rails Backend

### 1.1 Database Migration

**Migration: Create leads table**

```ruby
# db/migrate/xxx_create_leads.rb
create_table :leads do |t|
  t.references :project, null: false, foreign_key: true
  t.string :email, null: false
  t.string :name
  t.timestamps
end

add_index :leads, [:project_id, :email], unique: true
```

No token storage needed - `signed_id` derives tokens from the project ID and Rails' `secret_key_base`.

### 1.2 Models

**Lead model** (`app/models/lead.rb`)

```ruby
class Lead < ApplicationRecord
  belongs_to :project

  validates :email, presence: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP },
                    uniqueness: { scope: :project_id, case_sensitive: false }
  validates :name, length: { maximum: 255 }, allow_blank: true

  before_validation :normalize_email

  private

  def normalize_email
    self.email = email&.downcase&.strip
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

### 1.3 Why signed_id Instead of JWT

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

### 1.4 Public API Endpoint

**Controller** (`app/controllers/api/v1/leads_controller.rb`)

```ruby
class API::V1::LeadsController < ActionController::API
  def create
    project = Project.find_signed!(params[:token], purpose: :lead_signup)

    lead = project.leads.find_or_initialize_by(email: lead_params[:email])
    lead.assign_attributes(lead_params.except(:email))

    if lead.save
      render json: { success: true }, status: :created
    else
      render json: { errors: lead.errors }, status: :unprocessable_entity
    end
  rescue ActiveSupport::MessageVerifier::InvalidSignature
    render json: { error: "Invalid token" }, status: :unauthorized
  end

  private

  def lead_params
    params.permit(:email, :name)
  end
end
```

#### Why `ActionController::API` instead of `API::BaseController`?

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

### 1.5 CORS Configuration

#### Why CORS is needed for this endpoint (but not others)

**CORS (Cross-Origin Resource Sharing)** is a browser security feature that blocks JavaScript from making requests to a different domain than the page was loaded from.

| Caller                        | API Endpoint               | Same Origin?     | CORS Needed? |
| ----------------------------- | -------------------------- | ---------------- | ------------ |
| `launch10.ai` React frontend  | `launch10.ai/api/v1/*`     | ✓ Yes            | No           |
| Langgraph service (server)    | `launch10.ai/api/v1/*`     | N/A (no browser) | No           |
| `cool-startup.launch10.dev`   | `launch10.ai/api/v1/leads` | ✗ No             | **Yes**      |
| `my-idea.com` (custom domain) | `launch10.ai/api/v1/leads` | ✗ No             | **Yes**      |

Our existing APIs are called from the same origin (our React frontend) or server-to-server (Langgraph). The leads endpoint is unique - it's called from deployed landing pages on different domains.

#### Implementation

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
      max_age: 600
  end
end
```

**Note:** This config is scoped to only `/api/v1/leads`. All other APIs remain same-origin only - no security change for authenticated endpoints.

### 1.6 Files to Modify/Create

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
