# Plan: Environment Variables (Simplified)

## Summary

Inject project-level environment variables into deployed websites at build time. Variables like `VITE_API_BASE_URL` and `VITE_SIGNUP_TOKEN` are written to a `.env` file during the Rails build process.

**Simplification:** No database model needed. Both values are derived (not stored), so we generate them inline during build and document them in the system prompt.

## Architecture

**Flow:**
```
codingAgentGraph
    ↓ agent knows env vars from system prompt
    ↓ generates code using import.meta.env.VITE_*
deployGraph → deployWebsiteNode
    ↓ calls Rails API
Rails build! (buildable.rb)
    ↓ writes website files from DB to temp dir
    ↓ writes .env file with computed values  ← NEW
    ↓ runs pnpm build (Vite reads .env)
    ↓ uploads dist/ to R2
```

---

## Environment Variables

| Key | Source | Purpose |
|-----|--------|---------|
| `VITE_SIGNUP_TOKEN` | `project.signup_token` | Authenticates lead capture API calls |
| `VITE_API_BASE_URL` | `Rails.configuration.x.api_base_url` | Base URL for API calls from deployed sites |

**Values by environment:**
- Development: `http://localhost:3000`
- Production: `https://app.launch10.com`

---

## Implementation Steps

### Step 1: Add API Base URL Config

```ruby
# config/application.rb
config.x.api_base_url = ENV.fetch("API_BASE_URL", "http://localhost:3000")
```

```ruby
# config/environments/production.rb
config.x.api_base_url = "https://app.launch10.com"
```

### Step 2: Add signup_token to Project

```ruby
# app/models/project.rb
class Project < ApplicationRecord
  def signup_token
    # Deterministic token derived from project ID + Rails secret
    # Regeneratable, no storage needed
    signed_id(purpose: :lead_capture)
  end
end
```

### Step 3: Update Buildable Concern

```ruby
# app/models/concerns/website_deploy_concerns/buildable.rb

def build!
  update!(status: "building")
  FileUtils.mkdir_p(temp_dir)

  write_website_files!
  write_env_file!  # NEW

  run_build!
end

private

def write_env_file!
  env_vars = {
    "VITE_SIGNUP_TOKEN" => website.project.signup_token,
    "VITE_API_BASE_URL" => Rails.configuration.x.api_base_url
  }
  File.write(File.join(temp_dir, ".env"), env_vars.map { |k, v| "#{k}=#{v}" }.join("\n"))
end
```

### Step 4: Update Coding Agent System Prompt

Add to the coding agent's system prompt (in `langgraph_app`):

```markdown
## Available Environment Variables

Your generated code can use these Vite environment variables (available via `import.meta.env`):

- `VITE_API_BASE_URL` - Base URL for API calls (e.g., lead capture). Use for fetch calls to the backend.
- `VITE_SIGNUP_TOKEN` - Project-specific token for authenticating lead capture API calls.

Example usage:
```typescript
fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/leads`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Signup-Token': import.meta.env.VITE_SIGNUP_TOKEN
  },
  body: JSON.stringify({ email })
})
```
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `rails_app/config/application.rb` | Modify | Add `config.x.api_base_url` |
| `rails_app/config/environments/production.rb` | Modify | Set production API URL |
| `rails_app/app/models/project.rb` | Modify | Add `signup_token` method |
| `rails_app/app/models/concerns/website_deploy_concerns/buildable.rb` | Modify | Add `write_env_file!` |
| `langgraph_app/app/nodes/codingAgent/prompts/system.ts` | Modify | Document env vars |

---

## Verification

1. **Rails console test:**
   ```ruby
   project = Project.first
   project.signup_token
   # => "eyJfcmFpbHMiOnsibWVzc2FnZSI6..."
   ```

2. **Build test:**
   ```ruby
   deploy = website.deploys.create!
   # Check temp dir has .env file:
   # VITE_SIGNUP_TOKEN=eyJfcmFpbHMi...
   # VITE_API_BASE_URL=http://localhost:3000
   ```

3. **End-to-end:**
   - Deploy a website
   - Inspect built JS for `import.meta.env.VITE_SIGNUP_TOKEN` value embedded
   - Submit form, verify lead created with valid token

---

## Relationship to Other Plans

This is a **standalone plan** that provides infrastructure used by:

- **email-backend.md** - Uses `VITE_SIGNUP_TOKEN` for lead capture authentication
- **website-deploy-graph.md** - Build process writes .env file

This plan should be implemented in **Phase 1** (Foundation) since it's a prerequisite for email-backend.md.

---

## Future Enhancements (Out of Scope)

If user-defined environment variables are needed later:
- Create `EnvironmentVariable` model with encryption
- Add UI for managing custom variables
- Merge user vars with system vars in `write_env_file!`

For now, inline generation is sufficient for the 2 system-managed variables.
