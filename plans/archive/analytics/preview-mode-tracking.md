# Plan: Preview Mode for tracking.ts

Clickup: https://app.clickup.com/t/86b84w3bk

## Problem

When users preview their landing page in WebContainer (before deploy), form submissions fail because:

- `VITE_API_BASE_URL` and `VITE_SIGNUP_TOKEN` aren't set
- `L10.createLead()` throws `LeadError("Configuration error")`
- Users see an error instead of the success flow

## Goal

- **Preview mode**: Forms "work" - show success without real API calls
- **Production mode**: Real API calls with proper error handling

## Solution

### 1. Update tracking.ts to detect preview mode

```typescript
// In-memory store for preview mode (simulates backend)
const previewStore = new Set<string>();

async createLead(email: string, options?: { value?: number; name?: string }): Promise<void> {
  const previewMode = import.meta.env.VITE_PREVIEW_MODE === 'true';

  // Preview mode: simulate real behavior with local store
  if (previewMode) {
    console.log('[L10] Preview mode - processing:', email);

    // Simulate "email already exists" error
    if (previewStore.has(email.toLowerCase())) {
      throw new LeadError("This email has already been submitted");
    }

    // Store the email and succeed
    previewStore.add(email.toLowerCase());
    return;
  }

  // Production mode: existing behavior
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const signupToken = import.meta.env.VITE_SIGNUP_TOKEN;

  if (!apiBaseUrl || !signupToken) {
    console.error("[L10] Missing VITE_API_BASE_URL or VITE_SIGNUP_TOKEN");
    throw new LeadError("Configuration error");
  }

  // ... real API call
}
```

This gives the AI model and user realistic behavior:

- First submission succeeds
- Duplicate email throws error (like production would)
- No fake network delays needed

### 2. Set `VITE_PREVIEW_MODE=true` in WebContainer

**Chosen approach**: WebContainer API - pass env var when spawning dev server.

In `frontend_old/runtime/action-runner.ts`, update `#runShellAction`:

```typescript
const process = await webcontainer.spawn("bash", ["-c", action.task.payload?.command], {
  env: {
    npm_config_yes: true,
    VITE_PREVIEW_MODE: "true", // Add this
  },
});
```

## Files to Modify

1. **`rails_app/templates/default/src/lib/tracking.ts`**
   - Add preview mode detection at the start of `createLead()`
   - Simulate success with delay when in preview mode

2. **`rails_app/app/javascript/frontend_old/runtime/action-runner.ts`**
   - Add `VITE_PREVIEW_MODE: 'true'` to spawn env in `#runShellAction`

## Why This Works

- WebContainer preview: `pnpm dev` runs with `VITE_PREVIEW_MODE=true` in env
- Buildable deploy: `pnpm build` uses `.env` from `write_env_file!` (no preview flag)
- Env vars are inherited by child processes, so Vite sees the flag

## Verification

1. **Preview test**: Run a website in WebContainer
   - First form submit → success
   - Same email again → "This email has already been submitted" error
2. **Deploy test**: Buildable tests verify `.env` doesn't include `VITE_PREVIEW_MODE`
3. **Unit test**: Test the preview store logic in tracking.ts

## Edge Cases

- Store resets on page refresh (expected - it's in-memory)
- Case-insensitive email matching (handled with `.toLowerCase()`)
