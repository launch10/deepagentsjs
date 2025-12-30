# Deployment: Decision History

> Decisions about Cloudflare, R2, Atlas, domains, and infrastructure. Most recent first.

---

## Current State

- **File Storage:** Cloudflare R2 with separate buckets per environment (`uploads` for prod, `dev-uploads` for dev)
- **Asset Host:** `https://uploads.launch10.ai` (prod), `https://dev-uploads.launch10.ai` (dev)
- **CORS:** R2 buckets must be configured to allow cross-origin requests from app origins

---

## Decision Log

### 2024-12-30: Configure CORS on R2 buckets instead of using crossOrigin attribute

**Context:** Images from R2 were blocked in development with error:
```
ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep
```

This is caused by Cross-Origin Embedder Policy (COEP) blocking resources that don't have proper CORS headers.

**Decision:** Configure CORS policy directly on Cloudflare R2 buckets rather than adding `crossOrigin="anonymous"` to img tags.

**Why:**
- Fixes the issue at the source (infrastructure level)
- Works for all image usages across the entire app
- Doesn't require code changes for every img tag
- More maintainable - new image usages automatically work

**Configuration:** In Cloudflare R2 dashboard → bucket → Settings → CORS Policy:
```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

For production, add the production origins as well.

**Alternative considered:** Adding `crossOrigin="anonymous"` to all img tags
- Pros: Quick fix, no infrastructure changes
- Cons: Must remember for every img tag, scattered across codebase, treats symptom not cause

**Status:** Current

---
