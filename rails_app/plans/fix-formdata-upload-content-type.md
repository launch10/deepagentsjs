# fix: FormData uploads fail with 400 due to incorrect Content-Type header

## Overview

File uploads fail with `400 Bad Request` because the API client sends `Content-Type: application/json` even when the body is FormData. Rails tries to parse multipart form data as JSON, causing:

```
JSON::ParserError (invalid number: '------WebKitFormBoundary...')
```

## Problem Statement

**Root Cause**: In `shared/lib/api/client.ts:47-52`, `sharedHeaders()` explicitly sets `Content-Type: application/json`:

```typescript
const sharedHeaders = (): Record<string, string> => {
  return {
    "Content-Type": "application/json",  // <-- THE PROBLEM
    "Accept": "application/json",
  };
};
```

These headers are baked into the client at creation time (line 110). When `bodySerializer` returns FormData, openapi-fetch's automatic Content-Type omission doesn't work because the header was already set in the default headers.

**Why previous fixes failed**:
1. `headers: { "Content-Type": null }` per-request - openapi-fetch constructs a `Request` object, so header overrides don't work as expected
2. Custom fetch wrapper - By the time our custom fetch receives the `Request` object, the body is a ReadableStream, not FormData
3. Middleware approach - Same issue: `Request.body` is not inspectable after construction

## Proposed Solution

Remove `Content-Type` from `sharedHeaders()`. Let openapi-fetch handle it automatically:

| Body Type | openapi-fetch Behavior |
|-----------|----------------------|
| JSON object | Auto-sets `Content-Type: application/json` |
| FormData | Omits header (browser sets `multipart/form-data; boundary=...`) |
| No body | No Content-Type header |

This is the [documented behavior](https://openapi-ts.dev/openapi-fetch/api):

> "When the bodySerializer returns an instance of FormData, Content-Type is omitted, allowing the browser to set it automatically with the correct message part boundary."

## Technical Approach

### Files to Change

| File | Change |
|------|--------|
| `shared/lib/api/client.ts` | Remove `Content-Type` from `sharedHeaders()`, remove complex `createFormDataAwareFetch` wrapper |

### Implementation

```typescript
// shared/lib/api/client.ts

// BEFORE (lines 47-52)
const sharedHeaders = (): Record<string, string> => {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
};

// AFTER
const sharedHeaders = (): Record<string, string> => {
  return {
    "Accept": "application/json",
  };
};
```

Also remove the `createFormDataAwareFetch` wrapper (lines 80-122) since it's no longer needed:

```typescript
// REMOVE this entire function
const createFormDataAwareFetch = (): typeof fetch => {
  // ... all of this
};

// And remove from client creation (line 111)
const client = createClient<paths>({
  baseUrl,
  headers: headers(jwtToken),
  // fetch: createFormDataAwareFetch(),  <-- REMOVE THIS LINE
});
```

## Acceptance Criteria

- [ ] File uploads work (no 400 error)
- [ ] JSON API requests still work (brainstorms, projects, etc.)
- [ ] No `Content-Type: application/json` header on FormData requests
- [ ] `Content-Type: application/json` auto-set on JSON requests

## Test Plan

### Manual Testing

1. **File upload**: Attach an image in brainstorm input, submit
2. **JSON request**: Create a new brainstorm without attachments
3. **Check headers**: In Network tab, verify:
   - FormData request: `Content-Type: multipart/form-data; boundary=...`
   - JSON request: `Content-Type: application/json`

### Verify in Browser DevTools

```
Network tab > Request > Headers > Request Headers
```

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| JSON requests break | Low | openapi-fetch auto-sets Content-Type for JSON (documented) |
| Server requires explicit header | Low | Rails auto-detects content type from body |

## References

- [openapi-fetch API docs](https://openapi-ts.dev/openapi-fetch/api) - Content-Type behavior
- [GitHub Issue #1548](https://github.com/openapi-ts/openapi-typescript/issues/1548) - FormData Content-Type fix
- [GitHub Issue #858](https://github.com/hey-api/openapi-ts/issues/858) - Community discussion

## Files

- `shared/lib/api/client.ts:47-52` - Remove Content-Type from sharedHeaders
- `shared/lib/api/client.ts:80-122` - Remove createFormDataAwareFetch wrapper
- `shared/lib/api/client.ts:111` - Remove custom fetch from client creation
