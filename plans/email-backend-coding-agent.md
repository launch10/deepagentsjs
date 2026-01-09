# Email Lead Capture - Coding Agent Plan

## Background

Public API endpoint for landing pages to submit email signups. Uses Rails `signed_id` for stateless, tamper-proof authentication.

See `plans/email-backend.md` for Rails backend implementation details.

---

## Review Decisions (2026-01-08)

This plan was reviewed by DHH Rails Reviewer, Kieran Rails Reviewer, and Code Simplicity Reviewer. Key feedback and decisions:

### Rejected Feedback

| Criticism | Response | Decision |
|-----------|----------|----------|
| "Use HTML forms, not React state" | We deploy static sites to Cloudflare. No SSR. Our template uses React/Tailwind - one stack the agent knows well. Consistency > theoretical purity. | **Keep React** |
| "Server-render the token via ERB" | Static sites. No server. Cloudflare serves pre-built files. | **Keep build-time injection** |
| "Remove 'When to Add Email Capture' - let users decide" | This is 2026. Agentic architecture requires baking in philosophy. Launch10's philosophy: validate business ideas with fake pricing pages leading to email capture. This is intentional agent guidance. | **Keep philosophical guidance** |
| "Build-time env vars are wrong, use SSR" | Analyzed alternatives (see below). Build-time is correct for static sites with public tokens. | **Keep Buildable approach** |
| "Remove architecture table - agent doesn't need it" | Agent benefits from understanding boundaries of its responsibility. | **Keep architecture section** |

### Accepted Feedback

| Criticism | Response | Decision |
|-----------|----------|----------|
| "Clarify conversion tracking section" | Agent will see this code during fixes. Needs to understand it exists but shouldn't touch it. | **Clarified below** |
| "Remove `onSuccess` callback - YAGNI" | Correct. Not demonstrated as needed. | **Removed from example** |

### Build-time vs SSR Analysis

The `signup_token` is a `signed_id` that identifies which project a lead belongs to. It's **public by design** - embedded in publicly accessible landing pages.

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Build-time env vars (current)** | Simple, static, Cloudflare loves it | Token in JS bundle (but it's public anyway) | **Chosen** |
| Atlas SSR at request time | Token not in bundle | KV storage, worker compute, cache invalidation, one bug = all sites down | Rejected |
| Fetch token at runtime | Rotatable without redeploy | Extra API call, loading state, CORS, latency | Over-engineered |
| Deploy-time HTML injection | Token in HTML not JS | Different complexity, same visibility | No benefit |

**Decision:** Build-time injection via Buildable is correct. The token is public, static sites are our architecture, and Atlas SSR adds blast radius risk (one bug breaks all customer sites).

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

**Philosophy:** Launch10 helps users validate business ideas. The best proof of demand is willingness to pay. Email capture on pricing pages captures intent before the product exists.

The agent should add email capture forms to:
- Pricing cards (waitlist for tiers) - **This is the core validation pattern**
- Hero CTAs ("Get early access", "Join waitlist")
- Footer signup forms

### Conversion Tracking & Instrumentation (Read-Only)

**Why this section exists:** When fixing pages, the agent will encounter instrumentation code that was injected during deployment. The agent needs to understand this code exists but must not modify it.

During deployment, `instrumentationNode` automatically injects:
- `L10_CONFIG` object (project configuration)
- `L10.conversion()` calls on form submissions
- `gtag` tracking code

**When you see this code during fixes:**
- Do NOT modify it
- Do NOT remove it
- Do NOT add similar code yourself
- Work around it when fixing unrelated issues

The deploy system manages instrumentation. Your job is beautiful pages.

---

## Example Component

Example component the agent might create:

```tsx
export function WaitingListForm() {
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
