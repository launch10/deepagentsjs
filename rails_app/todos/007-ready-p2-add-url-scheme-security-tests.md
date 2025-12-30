---
status: completed
priority: p2
issue_id: "007"
tags: [code-review, security, testing, brainstorm-ui]
dependencies: []
---

# Add Security Tests for Malicious URL Schemes

## Problem Statement

The social links URL validation appears correct but lacks explicit test coverage for malicious URL schemes like `javascript:` and `data:` URLs. These should be rejected by the validation, but explicit tests document the security requirement.

## Findings

**Model validation (looks correct):**
```ruby
# app/models/social_link.rb
validates :url, presence: true, format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]) }
```

**Missing tests:** No explicit tests for rejecting `javascript:`, `data:`, or other dangerous schemes.

## Proposed Solutions

### Option 1: Add Security Test Cases (Recommended)

Add to `spec/models/social_link_spec.rb`:

```ruby
describe "URL security" do
  it "rejects javascript: URLs" do
    social_link = build(:social_link, platform: "website", url: "javascript:alert(1)")
    expect(social_link).not_to be_valid
    expect(social_link.errors[:url]).to be_present
  end

  it "rejects data: URLs" do
    social_link = build(:social_link, platform: "website", url: "data:text/html,<script>alert(1)</script>")
    expect(social_link).not_to be_valid
  end

  it "rejects file: URLs" do
    social_link = build(:social_link, platform: "website", url: "file:///etc/passwd")
    expect(social_link).not_to be_valid
  end

  it "accepts https URLs" do
    social_link = build(:social_link, platform: "website", url: "https://example.com")
    expect(social_link).to be_valid
  end
end
```

**Pros:** Documents security requirements, catches regressions
**Cons:** None
**Effort:** Small (10 minutes)
**Risk:** None

## Recommended Action

Add security tests.

## Technical Details

**File:** `spec/models/social_link_spec.rb`

## Acceptance Criteria

- [x] Tests for `javascript:` URLs rejection exist
- [x] Tests for `data:` URLs rejection exist
- [x] Tests confirm `https://` URLs are accepted
- [x] All tests pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-30 | Created | Identified during security review |
| 2025-12-30 | Approved | Triage approved - status: ready |
| 2025-12-30 | Completed | Added 5 security tests (javascript:, data:, file:, https, http) - all pass |

## Resources

- Security sentinel report
- Model: `app/models/social_link.rb`
