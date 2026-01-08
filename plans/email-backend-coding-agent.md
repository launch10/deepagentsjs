# Email Lead Capture - Coding Agent Plan

## Background

Public API endpoint for landing pages to submit email signups. Uses Rails `signed_id` for stateless, tamper-proof authentication.

See `plans/email-backend.md` for Rails backend implementation details.

---

## Overview

The coding agent creates components for user landing pages that submit email signups to the Rails API.

**Key principle:** The agent knows which environment variables exist and uses them in code, but does NOT fetch tokens or write `.env` files. Environment variable injection is handled by Buildable at deploy time (see separate EnvironmentVariables ticket).

---

## Architecture

| Responsibility | Owner | Why |
|----------------|-------|-----|
| Know which env vars exist | Coding Agent | Writes code that uses `import.meta.env.VITE_*` |
| Inject env vars at build time | Buildable concern | Centralized build configuration |
| Fetch the token value | Rails (Buildable) | Already has access to `website.project` |

---

## Agent Guidance

### Available Environment Variables

The agent should know these variables exist and use them in code:

| Variable | Purpose | How to Use |
|----------|---------|------------|
| `VITE_API_BASE_URL` | Rails API base URL | Use in fetch calls |
| `VITE_SIGNUP_TOKEN` | Project's signup token | Pass to leads API |

**Prompt guidance for agent:**
```
When implementing email capture forms, use these environment variables:
- API endpoint: `${import.meta.env.VITE_API_BASE_URL}/api/v1/leads`
- Token: `import.meta.env.VITE_SIGNUP_TOKEN`

Do NOT hardcode URLs or tokens. Do NOT write .env files.
These values are injected at deploy time by the build system.
```

### When to Add Email Capture

The agent should add email capture forms to:
- Pricing cards (waitlist for tiers)
- Hero CTAs ("Get early access", "Join waitlist")
- Footer signup forms

### Conversion Tracking & Instrumentation (Read-Only)

During deployment, `instrumentationNode` automatically injects:
- `L10_CONFIG` object (project configuration)
- `L10.conversion()` calls on form submissions
- `gtag` tracking code

**If you see this code during fixes:**
- Do NOT modify it
- Do NOT add similar code yourself
- Work around it when fixing unrelated issues

The deploy system manages instrumentation. Your job is beautiful pages.

---

## Example Component

Example component the agent might create:

```tsx
export function WaitingListForm({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: import.meta.env.VITE_SIGNUP_TOKEN,
        email,
      }),
    });

    if (res.ok) {
      setStatus("success");
      onSuccess?.();
    } else {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
      />
      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Joining..." : "Join Waitlist"}
      </button>
      {status === "success" && <p>Thanks! We'll be in touch.</p>}
      {status === "error" && <p>Something went wrong. Please try again.</p>}
    </form>
  );
}
```

---

## Files to Modify

| File | Action |
|------|--------|
| Agent system prompt | Add guidance about available env vars |
| Template components (optional) | Add reusable WaitingListForm component |

---

## Verification

1. Generate a landing page with email capture
2. Deploy it
3. Submit email in form
4. Verify lead appears in Rails console
