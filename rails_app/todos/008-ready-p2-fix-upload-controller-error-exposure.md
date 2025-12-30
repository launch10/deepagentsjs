---
status: done
priority: p2
issue_id: "008"
tags: [code-review, security, rails, brainstorm-ui]
dependencies: []
---

# Fix Error Message Exposure in UploadsController

## Problem Statement

The UploadsController changed from returning a generic "invalid upload" error to exposing `e.message` directly to clients. Exception messages can leak internal paths, database errors, or third-party service details.

## Findings

**File:** `app/controllers/api/v1/uploads_controller.rb`

**Current code:**
```ruby
rescue => e
  Rails.logger.error "[Upload Error] #{e.class}: #{e.message}"
  Rails.logger.error e.backtrace.first(5).join("\n")
  render json: { errors: e.message }, status: :unprocessable_entity
```

**Problem:** `e.message` exposed to client could contain:
- Internal file paths
- Database error details
- Third-party service errors

**Additional issue:** The tests still expect `"invalid upload"` but code returns `e.message`:
```ruby
# spec/requests/uploads_spec.rb lines 128-129
expect(data["errors"]).to include("invalid upload")
```

## Proposed Solutions

### Option 1: Return Generic Error Message (Recommended)

```ruby
rescue => e
  Rails.logger.error "[Upload Error] #{e.class}: #{e.message}"
  Rails.logger.error e.backtrace.first(5).join("\n")
  render json: { errors: "invalid upload" }, status: :unprocessable_entity
```

**Pros:** Fixes security issue, tests will pass
**Cons:** Less informative error for debugging (but logs still have details)
**Effort:** Small (2 minutes)
**Risk:** None

### Option 2: Specific Exception Handling
Rescue specific exceptions and return appropriate messages:

```ruby
rescue ActiveRecord::RecordNotFound
  render json: { errors: "resource not found" }, status: :not_found
rescue ActiveRecord::RecordInvalid => e
  render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
rescue => e
  Rails.logger.error "[Upload Error] #{e.class}: #{e.message}"
  render json: { errors: "invalid upload" }, status: :unprocessable_entity
```

**Pros:** More specific errors where safe, generic fallback
**Cons:** More code
**Effort:** Small
**Risk:** Low

## Recommended Action

Option 1 - Return generic message for safety.

## Technical Details

**File:** `app/controllers/api/v1/uploads_controller.rb`
**Lines:** 24-27

## Acceptance Criteria

- [x] Error response returns generic "invalid upload" message
- [x] Detailed errors still logged
- [x] Tests pass (expect "invalid upload")

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-30 | Created | Identified during Kieran Rails review |
| 2025-12-30 | Approved | Triage approved - status: ready |
| 2025-12-30 | Resolved | Changed e.message to "invalid upload" in generic rescue block |

## Resources

- Kieran Rails reviewer report
- Security sentinel report
