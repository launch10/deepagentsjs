# Why JWT Authentication Between Services

## The Problem

Rails and Langgraph are separate services that need to share user identity. When a user makes a request to Langgraph, we need to know who they are without requiring them to log in again.

## The Decision

Use JWT (JSON Web Tokens) for stateless authentication between services.

## Why JWT (Simplicity)

The primary driver was **simplicity**. Alternatives considered:

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

## How It Works

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

## Token Contents

```json
{
  "sub": "user_123",
  "exp": 1735344000,
  "iat": 1735257600,
  "jti": "unique-token-id"
}
```

## Consequences

**Benefits:**
- No shared session store (Redis) needed between services
- Stateless - any Langgraph instance can validate
- Simple to implement and debug
- Standard, well-understood pattern

**Trade-offs:**
- 24-hour expiry means users re-auth daily (acceptable for beta)
- Can't revoke individual tokens (would need blocklist)
- Secret must be shared between services

## Security Considerations

- JWT stored in httpOnly cookie (not accessible to JavaScript)
- HTTPS required in production
- Secret stored in Rails credentials / environment variables
- 24-hour expiry limits damage from token theft

## Files Involved

- `rails_app/app/controllers/concerns/authorization.rb` - Token generation
- `langgraph_app/app/lib/server/langgraph/auth/auth.ts` - Token validation
- `JWT_SECRET` environment variable - Shared secret
