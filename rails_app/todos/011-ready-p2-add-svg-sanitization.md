---
status: done
priority: p2
issue_id: "011"
tags: [code-review, security, file-upload, brainstorm-ui, testing]
dependencies: []
---

# SVG Sanitization and Security Verification

## Problem Statement

The MediaUploader allows SVG uploads (`image/svg+xml`), but SVG files can contain embedded JavaScript that executes when rendered in a browser. This is a potential XSS vector if SVGs are served inline.

## Findings

**File:** `app/uploaders/media_uploader.rb`

**Content type allowlist (lines 36-38):**
```ruby
def content_type_allowlist
  [/image\//, /video\//, "application/pdf"]
end
```

The regex `/image\//` matches `image/svg+xml`.

**Risk:** SVG files stored on S3 are typically safe if:
1. Served with `Content-Disposition: attachment`
2. Served with `X-Content-Type-Options: nosniff`
3. CSP headers prevent inline script execution

**Unknown:** Whether S3 bucket is configured with these protections.

## Proposed Solutions

### Option 1: Sanitize SVG Uploads (Recommended if SVGs needed for logos)
Add SVG sanitization using a library like `sanitize-svg` or `loofah`:

```ruby
# In uploader or model
def sanitize_svg
  return unless file.content_type == 'image/svg+xml'
  sanitized = Loofah.scrub_fragment(file.read, :prune).to_s
  # Write sanitized content back
end
```

**Pros:** Removes malicious content, SVGs still usable
**Cons:** Requires additional dependency, processing overhead
**Effort:** Medium
**Risk:** Low

### Option 2: Block SVG Uploads
Explicitly exclude SVG from allowlist:

```ruby
def content_type_allowlist
  %w[image/jpeg image/png image/gif image/webp video/mp4 video/webm application/pdf]
end
```

**Pros:** Eliminates risk entirely
**Cons:** Cannot upload SVG logos
**Effort:** Small
**Risk:** Low (if SVG logos not needed)

### Option 3: Verify S3 Serving Headers
Check that S3 bucket serves SVGs safely and document the configuration.

**Pros:** No code changes
**Cons:** Relies on infrastructure configuration
**Effort:** Small
**Risk:** Medium (config could change)

## Recommended Action

Do BOTH:
1. Verify Carrierwave/R2 configuration for safe SVG serving
2. Add SVG sanitization to strip malicious content
3. Create thorough tests for both

## Technical Details

**Storage:** Carrierwave with Cloudflare R2

**Files to modify:**
- `app/uploaders/media_uploader.rb` - Add SVG sanitization callback
- `config/initializers/carrierwave.rb` - Verify R2 headers config

**Check R2/Carrierwave configuration for:**
- `Content-Disposition: attachment` for SVG files
- `X-Content-Type-Options: nosniff` header
- CSP policy that prevents inline scripts

**SVG sanitization approach:**
```ruby
# In uploader
before :store, :sanitize_svg

def sanitize_svg(file)
  return unless file.content_type == 'image/svg+xml'
  # Use loofah or similar to strip scripts, event handlers, etc.
end
```

## Acceptance Criteria

- [x] R2/Carrierwave configuration verified for SVG safety
- [x] SVG sanitization implemented (strips `<script>`, event handlers, etc.)
- [x] Test: SVG with `<script>` tag is sanitized
- [x] Test: SVG with `onload` event handler is sanitized
- [x] Test: SVG with `javascript:` URL is sanitized
- [x] Test: Clean SVG passes through unchanged
- [x] Test: Non-SVG files are not affected
- [x] Configuration documented

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-30 | Created | Identified during security review |
| 2025-12-30 | Approved | Triage approved - verify R2 config + add sanitization + thorough tests |
| 2025-12-30 | Completed | Implemented SVG sanitization with comprehensive tests |

## Implementation Summary

### Files Modified
- `config/initializers/carrierwave.rb` - Added security headers for SVG files (Content-Disposition: attachment, X-Content-Type-Options: nosniff)
- `app/uploaders/media_uploader.rb` - Added SVG sanitization via `process :sanitize_svg_file`
- `app/services/svg_sanitizer.rb` - New service class for SVG sanitization

### Files Created
- `app/services/svg_sanitizer.rb` - Sanitizes SVG content by removing:
  - `<script>` tags and CDATA blocks
  - Event handler attributes (onclick, onload, onerror, etc.)
  - javascript: URLs in href/xlink:href
  - data: URLs with script content types
  - foreignObject elements (can embed HTML with scripts)
- `spec/services/svg_sanitizer_spec.rb` - 25 unit tests for SvgSanitizer
- `spec/fixtures/files/clean.svg` - Clean SVG test fixture
- `spec/fixtures/files/malicious_script.svg` - SVG with script tags
- `spec/fixtures/files/malicious_onload.svg` - SVG with event handlers
- `spec/fixtures/files/malicious_javascript_url.svg` - SVG with javascript: URLs

### Test Coverage
- 44 tests total (25 SvgSanitizer + 19 MediaUploader)
- All tests passing

## Resources

- Security sentinel report
- MediaUploader: `app/uploaders/media_uploader.rb`
- SvgSanitizer: `app/services/svg_sanitizer.rb`
