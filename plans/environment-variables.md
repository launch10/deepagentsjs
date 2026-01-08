# Plan: EnvironmentVariable Model

## Summary

Create a new `EnvironmentVariable` model to store project-level environment variables that get injected into deployed websites at build time. Variables like `VITE_API_BASE_URL` and `VITE_SIGNUP_TOKEN` are written to a `.env` file during the Rails build process.

## Decisions Made

- **Encryption:** Yes, all values encrypted using ActiveRecord encryption
- **UI:** Backend-only for now (no user-facing UI)
- **System vars:** `VITE_SIGNUP_TOKEN` (per-project, auto-generated) + `VITE_API_BASE_URL` (from Rails config)

## Architecture

**Flow:**
```
instrumentationNode (LangGraph)
    ↓ injects L10_CONFIG, tracking code into website files
deployWebsiteNode
    ↓ calls Rails API
Rails build! (buildable.rb)
    ↓ writes website files from DB to temp dir
    ↓ writes .env file with decrypted env vars  ← NEW
    ↓ runs pnpm build (Vite reads .env)
    ↓ uploads dist/ to R2
```

**Key insight:** Values are encrypted, so Rails handles injection during build. However, LangGraph needs to know what env vars exist (for code generation context), so we provide a metadata API that returns keys + descriptions without values.

---

## Data Model

### EnvironmentVariable

```ruby
class EnvironmentVariable < ApplicationRecord
  belongs_to :project

  encrypts :value  # ActiveRecord encryption for secrets

  # Validations
  validates :key, presence: true,
                  uniqueness: { scope: :project_id },
                  format: { with: /\A[A-Z][A-Z0-9_]*\z/, message: "must be SCREAMING_SNAKE_CASE" }
  validates :value, presence: true

  # Scopes
  scope :vite_exposed, -> { where("key LIKE 'VITE_%'") }
  scope :server_only, -> { where.not("key LIKE 'VITE_%'") }
  scope :system_managed, -> { where(system: true) }
  scope :user_defined, -> { where(system: false) }
end
```

### Migration

```ruby
create_table :environment_variables do |t|
  t.references :project, null: false, foreign_key: true, index: true
  t.string :key, null: false
  t.text :value, null: false  # encrypted
  t.boolean :system, null: false, default: false  # system-managed vs user-defined
  t.text :description  # optional documentation
  t.timestamps
end

add_index :environment_variables, [:project_id, :key], unique: true
```

### Project Association

```ruby
class Project < ApplicationRecord
  has_many :environment_variables, dependent: :destroy

  # Convenience methods
  def env_vars_for_vite
    environment_variables.vite_exposed.pluck(:key, :value).to_h
  end

  def set_env_var(key, value, system: false)
    environment_variables.find_or_initialize_by(key: key).tap do |ev|
      ev.value = value
      ev.system = system
      ev.save!
    end
  end
end
```

---

## System Variables (Initial Scope)

| Key | Source | Purpose |
|-----|--------|---------|
| `VITE_SIGNUP_TOKEN` | Auto-generated per project | Authenticates lead capture API calls |
| `VITE_API_BASE_URL` | Rails config (environment-specific) | Base URL for API calls from deployed sites |

Both are system-managed (`system: true`). User-defined variables will be added in a future phase with UI.

**VITE_API_BASE_URL values:**
- Development: `http://localhost:3000`
- Production: `https://app.launch10.ai` (or configured value)

---

## LangGraph Integration (Metadata API)

LangGraph needs to know what env vars exist for code generation context (e.g., instrumentationNode generating API calls using `VITE_API_BASE_URL`).

### API Endpoint

```
GET /api/v1/projects/:id/environment_variables
Authorization: Bearer <jwt>

Response:
{
  "environment_variables": [
    {
      "key": "VITE_API_BASE_URL",
      "description": "Base URL for API calls from deployed sites",
      "system": true
    },
    {
      "key": "VITE_SIGNUP_TOKEN",
      "description": "Authenticates lead capture API calls",
      "system": true
    }
  ]
}
```

**Note:** Values are NOT returned - only keys and descriptions. LangGraph uses this to understand what's available, not to inject values.

### Usage in LangGraph

```typescript
// In buildContext.ts or instrumentationNode
const envVarMetadata = await railsApi.getEnvironmentVariables(projectId);

// Agent now knows: "Use import.meta.env.VITE_API_BASE_URL for API calls"
// Agent generates: fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/leads`, ...)
```

---

## Implementation Steps

### Step 1: Migration
Create `environment_variables` table with encrypted value column.

### Step 2: Model
Create `EnvironmentVariable` model with:
- `encrypts :value`
- Validations (key format, uniqueness per project)
- Scopes (`vite_exposed`, `system_managed`)

### Step 3: Project Association
Add `has_many :environment_variables` to Project with:
- `after_create` callback to seed system variables
- Helper method: `env_vars_for_build` returns hash of key/value pairs

### Step 4: API Endpoint
Create `Api::V1::EnvironmentVariablesController` with:
- `index` action that returns metadata (key, description, system) without values
- Scoped to project via nested route

### Step 5: Build Integration
Modify `buildable.rb` to write `.env` file:
```ruby
def write_env_file!
  env_vars = website.project.env_vars_for_build
  return if env_vars.empty?

  env_content = env_vars.map { |k, v| "#{k}=#{v}" }.join("\n")
  File.write(File.join(temp_dir, ".env"), env_content)
end
```

Call `write_env_file!` after writing website files, before `pnpm build`.

### Step 6: LangGraph Integration
- Add OpenAPI spec for the endpoint
- Create `EnvironmentVariablesAPIService` in shared lib
- Update `buildContext.ts` to fetch env var metadata

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `rails_app/db/migrate/xxx_create_environment_variables.rb` | Create | Table with encrypted value |
| `rails_app/app/models/environment_variable.rb` | Create | Model with encryption, validations |
| `rails_app/app/models/project.rb` | Modify | Add association + after_create callback |
| `rails_app/app/controllers/api/v1/environment_variables_controller.rb` | Create | Metadata API (no values) |
| `rails_app/config/routes/api.rb` | Modify | Add nested route under projects |
| `rails_app/app/models/concerns/website_deploy_concerns/buildable.rb` | Modify | Write .env before build |
| `shared/lib/api/services/environmentVariablesAPIService.ts` | Create | LangGraph API client |
| `langgraph_app/app/nodes/codingAgent/buildContext.ts` | Modify | Fetch env var metadata |

---

## Verification

1. **Rails console test:**
   ```ruby
   project = Project.create!(name: "Test", account: Account.first)
   project.environment_variables.pluck(:key)
   # => ["VITE_SIGNUP_TOKEN", "VITE_API_BASE_URL"]
   ```

2. **Encryption test:**
   ```ruby
   ev = project.environment_variables.first
   ev.value  # => decrypted value
   EnvironmentVariable.connection.select_value("SELECT value FROM environment_variables WHERE id = #{ev.id}")
   # => encrypted gibberish
   ```

3. **API endpoint test:**
   ```bash
   curl -H "Authorization: Bearer $JWT" \
     http://localhost:3000/api/v1/projects/1/environment_variables
   # Returns keys and descriptions, NOT values
   ```

4. **Build test:**
   ```ruby
   deploy = website.deploy
   # Check temp dir has .env file with correct content
   ```

5. **End-to-end:**
   - Deploy a website
   - Inspect built JS for `import.meta.env.VITE_SIGNUP_TOKEN` value embedded

---

## Relationship to Other Plans

This is a **standalone plan** that provides infrastructure used by:

- **email-backend.md** - Uses `VITE_SIGNUP_TOKEN` for lead capture authentication
- **website-deploy-graph.md** - Build process writes .env file (this plan modifies `buildable.rb`)
- **analytics-tracking.md** - Could use env vars for `L10_CONFIG.googleAdsId` in future

This plan should be implemented in **Phase 1** (Foundation) since it's a prerequisite for email-backend.md.

---

## Future Enhancements (Out of Scope)

- User-facing UI for managing custom environment variables
- Server-only variables (non-VITE_ prefix) for backend use
- Environment-specific overrides (dev vs staging vs production)
- Audit logging for env var changes
