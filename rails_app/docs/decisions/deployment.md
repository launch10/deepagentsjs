# Deployment: Decision History

> Decisions about Cloudflare, R2, Atlas, domains, and infrastructure. Most recent first.

---

## Current State

- **File Storage:** Cloudflare R2 with separate buckets per environment (`uploads` for prod, `dev-uploads` for dev)
- **Asset Host:** `https://uploads.launch10.com` (prod), `https://dev-uploads.launch10.com` (dev)
- **CORS:** R2 buckets configured with `AllowedOrigins: *`
- **CORP Header:** Cloudflare Transform Rule adds `Cross-Origin-Resource-Policy: cross-origin` to all R2 responses
- **WebContainer Compatibility:** Images from R2 load correctly in WebContainer previews

---

## Decision Log

### 2025-01-20: Add CORP header via Cloudflare Transform Rule for WebContainer images

**Context:** Images uploaded to R2 and served via `dev-uploads.launch10.com` / `uploads.launch10.com` were not displaying in WebContainer previews. WebContainers run on `*.webcontainer-api.io` and enforce strict COEP (`Cross-Origin-Embedder-Policy: require-corp`). Cross-origin resources must explicitly opt-in via the `Cross-Origin-Resource-Policy` header.

**Decision:** Add a Cloudflare Response Header Transform Rule that sets `Cross-Origin-Resource-Policy: cross-origin` on all responses from the uploads subdomains.

**Configuration:**
- Rule name: "CORP Header for WebContainer Images (WebPreview)"
- Match: `(http.host wildcard r"dev-uploads.launch10.com*") or (http.host wildcard r"uploads.launch10.com*")`
- Action: Set static header `Cross-Origin-Resource-Policy` = `cross-origin`

**Why:**
- WebContainers require CORP header for cross-origin resources
- R2 doesn't natively support custom response headers
- Cloudflare Transform Rules add headers at the edge with zero latency impact
- No code changes required

**Security consideration:** Setting CORP to `cross-origin` allows any site to embed these images. This is acceptable because:
- These are public landing page assets meant to be displayed publicly
- Images were already embeddable via `<img>` tags (CORP only affects COEP contexts)
- The deployed landing pages will serve these images on arbitrary customer domains anyway

**Supersedes:** "Use crossOrigin='anonymous' for R2 images with COEP" (2024-12-30) - that approach worked for the Rails app but not for WebContainer previews which have stricter requirements.

**Status:** Current

---

### 2024-12-30: Use crossOrigin="anonymous" for R2 images with COEP

**Context:** Images from R2 were blocked with error:
```
ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep
```

R2 CORS was already configured with `AllowedOrigins: *`, but the app uses **COEP** (Cross-Origin Embedder Policy: require-corp). COEP requires cross-origin resources to either:
1. Have `Cross-Origin-Resource-Policy: cross-origin` header, OR
2. Be fetched in CORS mode via `crossorigin` attribute

**Decision:** Add `crossOrigin="anonymous"` to img tags loading R2 images.

**Why:**
- R2 CORS is already configured correctly
- Adding `crossorigin="anonymous"` triggers CORS mode, which satisfies COEP
- No infrastructure changes needed
- Works immediately

**Trade-off:** Must add `crossOrigin="anonymous"` to any img tag loading from R2. This is acceptable since R2 images are only used in specific components (logo upload, project images).

**Alternative considered:** Adding `Cross-Origin-Resource-Policy: cross-origin` header to R2
- R2 doesn't easily support custom response headers without Cloudflare Workers
- Would require additional infrastructure complexity

**Status:** Superseded by "Add CORP header via Cloudflare Transform Rule" (2025-01-20) for WebContainer contexts. Still valid for Rails app image loading.

---
