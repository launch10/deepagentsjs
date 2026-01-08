# Email Lead Capture Implementation Plan

## Background

Public API endpoint for landing pages to submit email signups. Uses Rails `signed_id` for stateless, tamper-proof authentication.

## Overview

Coding agent will create components for user landing pages that submit email signups to the Rails API.

See plans/email-backend.md for implementation details.

## Two separate agents

There are two separate agents:

1. Coding agent: Creates landing pages
2. Deployment agent: Deploys landing pages - ensures proper analytics are injected (so will need access to this information and same tooling, even if it's already properly injected via the coding agent)

## Deployment

The deployment agent calls through to Rails using JobRunApiService.

This calls Buildable, which injects the environment variables into the build context.

## Part 2: Langgraph Agent Updates

### 2.1 Token Injection Strategy

The signup token needs to be available to agent to inject into the React components.

**Recommended: Build-time injection via environment variable**

1. When coding agent starts, call `project.signup_token` via Rails API
2. Inject as `VITE_SIGNUP_TOKEN` in the project's `.env` file
3. Components access via `import.meta.env.VITE_SIGNUP_TOKEN`

**Implementation:**

- Update `buildContext.ts` to fetch and include signup_token
- Write `.env` file with token before agent runs
- Template includes API base URL: `VITE_API_BASE_URL`

### 2.2 Email Capture Component

Create a reusable WaitingListModal component in templates:

```tsx
// Template component: WaitingListModal.tsx
export function WaitingListModal({ isOpen, onClose, tierName }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");

    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: import.meta.env.VITE_SIGNUP_TOKEN,
        email,
        name,
      }),
    });

    setStatus(res.ok ? "success" : "error");
    // Note: L10.conversion({ label: 'signup' }) is injected by instrumentationNode at deploy time
  };

  // ... modal UI with form
}
```

### 2.3 Agent Guidance Updates

**Important:** The coding agent should NOT add tracking code. All tracking is handled by `instrumentationNode` at deploy time.

The agent only needs to know:

1. When to add email capture: Pricing cards, hero CTAs, footer
2. How to implement: Use WaitingListModal component

### 2.4 Files to Modify/Create

| File                                                                | Action                       |
| ------------------------------------------------------------------- | ---------------------------- |
| `langgraph_app/app/nodes/codingAgent/utils/buildContext.ts`         | Modify (fetch signup_token)  |
| `langgraph_app/app/templates/*/src/components/WaitingListModal.tsx` | Create                       |
| `langgraph_app/app/services/core/railsApi/projectsAPIService.ts`    | Modify (expose signup_token) |

---

## Part 3: Deploy Flow Integration

### 3.1 Token Availability

Token is derived from project ID via `signed_id`, so it's always available. No storage or generation needed.

### 3.2 Environment Variables in Build

The `.env` file with `VITE_SIGNUP_TOKEN` is written by the agent during page generation. Vite inlines these at build time, so the token is baked into the deployed JS bundle.

### 3.3 Conversion Tracking

Conversion tracking (`L10.conversion({ label: 'signup' })`) is **NOT** added by the coding agent. It is injected by `instrumentationNode` in `deployGraph` at deploy time. This keeps the coding agent focused on beautiful pages.

### 3.4 Token Regeneration Behavior

**Important limitation:** If token revocation is implemented later (via `signup_token_version`), already-deployed pages will have the old token baked in. Options:

1. Accept limitation - old deploys stop working (user must redeploy)
2. Auto-redeploy when token regenerates
3. Store multiple valid token versions (adds complexity)

For MVP, option 1 is acceptable. Document for users that regenerating tokens requires redeployment.

---

## Implementation Order

1. Rails: Add `rack-cors` gem, bundle install
2. Rails: Database & Models (migration, Lead model, Project updates)
3. Rails: API Endpoint (leads controller, route, CORS initializer)
4. Langgraph: Token Injection (buildContext, env file)
5. Langgraph: Component (WaitingListModal template)
6. Testing (manual test, then specs)

---

## Verification Plan

1. Unit tests: Lead model validations, email normalization
2. Request spec: POST /api/v1/leads with valid/invalid tokens
3. Integration test:
   - Create project → generate page → deploy → submit form → verify lead created
4. Manual test:
   - Generate a landing page with pricing tiers
   - Click "Join Waitlist" on a tier
   - Submit email in modal
   - Verify lead appears in Rails console

---

## Security Considerations

- Tokens are cryptographically signed using Rails' `secret_key_base`
- Tokens are purpose-scoped (`:lead_signup`) - can't be used for other operations
- Rate limiting handled at Cloudflare layer
- Email validation and normalization prevents injection and duplicates
- CORS allows all origins but only POST to /api/v1/leads
- No PII beyond email/name stored
- Tokens are long-lived but can be revoked via version increment (future)
