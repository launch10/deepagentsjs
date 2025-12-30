# Deployment: Decision History

> Decisions about Cloudflare, R2, Atlas, domains, and infrastructure. Most recent first.

---

## Current State

- **File Storage:** Cloudflare R2 with separate buckets per environment (`uploads` for prod, `dev-uploads` for dev)
- **Asset Host:** `https://uploads.launch10.ai` (prod), `https://dev-uploads.launch10.ai` (dev)
- **CORS:** R2 buckets configured with `AllowedOrigins: *`
- **COEP:** App uses Cross-Origin Embedder Policy, requiring `crossOrigin="anonymous"` on cross-origin images

---

## Decision Log

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

**Status:** Current

---
