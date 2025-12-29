# Authentication: Decision History

> Decisions about user authentication and service-to-service auth. Most recent first.

---

## Current State

JWT tokens issued by Rails, validated by Langgraph. 24-hour expiry. Stored in httpOnly cookies. No session store needed between services.

---

## Decision Log

### 2025-12-28: Use JWT with 24-hour expiry

**Context:** Rails and Langgraph are separate services that need to share user identity. When a user makes a request to Langgraph, we need to know who they are without requiring them to log in again.

**Decision:** Use JWT (JSON Web Tokens) for stateless authentication between services.

**Why:** The primary driver was **simplicity**.

| Approach | Complexity | Trade-offs |
|----------|------------|------------|
| **JWT** | Low | Stateless, no shared session store needed |
| Shared sessions | Medium | Requires shared Redis, cookie domain config |
| API keys | Medium | Per-user key management, revocation complexity |
| OAuth | High | Overkill for internal service-to-service |

JWT won because:
1. Rails generates the token (one line of code)
2. Langgraph validates it (one middleware)
3. No shared infrastructure required beyond the secret

**How it works:**
```
1. User logs in via Rails (Devise)
2. Rails generates JWT:
   - sub: user ID
   - exp: 24 hours from now
   - iat: issued at timestamp
   - jti: unique token ID
3. JWT stored in httpOnly cookie
4. Frontend sends JWT to Langgraph in Authorization header
5. Hono middleware validates JWT and extracts user
6. All Langgraph resources scoped to that user
```

**Trade-offs:**
- 24-hour expiry means users re-auth daily (acceptable for beta)
- Can't revoke individual tokens (would need blocklist)
- Secret must be shared between services

**Security considerations:**
- JWT stored in httpOnly cookie (not accessible to JavaScript)
- HTTPS required in production
- Secret stored in Rails credentials / environment variables
- 24-hour expiry limits damage from token theft

**Status:** Current

---

## Files Involved

- `rails_app/app/controllers/concerns/authorization.rb` - Token generation
- `langgraph_app/app/lib/server/langgraph/auth/auth.ts` - Token validation
- `JWT_SECRET` environment variable - Shared secret
