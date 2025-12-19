# Subpath Deployment Architecture

## Overview

Launch10 allows multiple websites to be deployed under the same domain at different paths. For example:

- `example.launch10.site/` → Website A (root)
- `example.launch10.site/bingo/` → Website B
- `example.launch10.site/promo/` → Website C

This document explains how subpath deployment works, why we're restricted to single-level paths, and what would be required to support multi-level paths in the future.

## System Components

### 1. Rails App (WebsiteUrl Model)

The `WebsiteUrl` model maps a website to a domain + path combination:

```ruby
# WebsiteUrl records:
{ website_id: 1, domain: "example.launch10.site", path: "/" }
{ website_id: 2, domain: "example.launch10.site", path: "/bingo" }
```

### 2. Atlas (Cloudflare Worker)

Atlas is the Cloudflare Worker that serves deployed websites. When a request comes in:

1. Extracts hostname and pathname from the URL
2. Finds the matching `WebsiteUrl` using longest-path-match algorithm
3. Strips the matched path prefix from the request
4. Fetches the corresponding file from R2 storage
5. Returns the file to the browser

Example request flow for `https://example.launch10.site/bingo/pricing`:

```
1. pathname = "/bingo/pricing"
2. WebsiteUrl match: { path: "/bingo", website_id: 2 }
3. Stripped path: "/pricing" → looks for "pricing/index.html" in R2
4. R2 key: "production/2/live/pricing/index.html"
```

### 3. Vite Build System

Websites are React SPAs built with Vite. The `vite.config.ts` uses relative paths:

```typescript
export default defineConfig({
  base: "./", // Relative asset paths
  // ...
});
```

This produces HTML like:

```html
<script type="module" src="./assets/index-abc123.js"></script>
<link rel="stylesheet" href="./assets/index-def456.css" />
```

### 4. React Router (BrowserRouter)

The React app uses `BrowserRouter` for client-side routing:

```tsx
<BrowserRouter basename={window.__BASENAME__ || "/"}>
  <Routes>
    <Route path="/" element={<IndexPage />} />
    <Route path="/pricing" element={<PricingPage />} />
  </Routes>
</BrowserRouter>
```

## The Problem: How Browsers Resolve Relative Paths

When the browser is at a URL, relative paths (like `./assets/app.js`) are resolved based on the **current directory** of that URL.

### Without Trailing Slash

URL: `https://example.launch10.site/bingo`

The browser treats `/bingo` as a **file**, not a directory. The "current directory" is `/`.

```
./assets/app.js → /assets/app.js  ❌ WRONG
```

This request goes to the root website, not the `/bingo` website.

### With Trailing Slash

URL: `https://example.launch10.site/bingo/`

The browser treats `/bingo/` as a **directory**. The "current directory" is `/bingo/`.

```
./assets/app.js → /bingo/assets/app.js  ✅ CORRECT
```

### Solution: Trailing Slash Redirect

Atlas automatically redirects subpath URLs to include a trailing slash:

```
GET /bingo → 301 Redirect → /bingo/
```

This is implemented in `atlas/src/index-public.tsx`:

```typescript
if (urlMatch.matchedPath !== "/" && pathname === urlMatch.matchedPath) {
  const redirectUrl = new URL(c.req.url);
  redirectUrl.pathname = pathname + "/";
  return Response.redirect(redirectUrl.toString(), 301);
}
```

## The Problem: React Router Basename

React Router's `BrowserRouter` uses the URL pathname to determine which route to render. When deployed to a subpath, it needs to know the "base" of the application.

### Without Basename

If deployed to `/bingo/` without a basename:

```tsx
<BrowserRouter>
  {" "}
  {/* No basename */}
  <Routes>
    <Route path="/" element={<IndexPage />} />
    <Route path="/pricing" element={<PricingPage />} />
  </Routes>
</BrowserRouter>
```

When user visits `/bingo/`:

- Router sees pathname `/bingo/`
- No route matches `/bingo/`
- Falls through to 404 or renders nothing

### With Basename

```tsx
<BrowserRouter basename="/bingo">
  <Routes>
    <Route path="/" element={<IndexPage />} />
    <Route path="/pricing" element={<PricingPage />} />
  </Routes>
</BrowserRouter>
```

When user visits `/bingo/`:

- Router strips basename, sees pathname `/`
- Matches `<Route path="/" />` ✅

When user visits `/bingo/pricing`:

- Router strips basename, sees pathname `/pricing`
- Matches `<Route path="/pricing" />` ✅

## The Challenge: Runtime Basename Detection

The website doesn't know its deployment path at build time. The same build artifact could theoretically be deployed to `/bingo/`, `/promo/`, or `/`.

We detect the basename at runtime in `index.html`:

```html
<script>
  window.__BASENAME__ = "/" + (window.location.pathname.split("/")[1] || "");
</script>
```

This extracts the **first path segment** from the current URL:

| URL                      | `__BASENAME__` |
| ------------------------ | -------------- |
| `/`                      | `/`            |
| `/bingo`                 | `/bingo`       |
| `/bingo/`                | `/bingo`       |
| `/bingo/pricing`         | `/bingo`       |
| `/bingo/pricing/details` | `/bingo`       |

The App.tsx then uses this:

```tsx
<BrowserRouter basename={window.__BASENAME__ || '/'}>
```

## Why Single-Level Paths Only

The runtime detection **only extracts the first path segment**. This works perfectly for single-level paths like `/bingo`.

But consider a multi-level WebsiteUrl path like `/marketing/campaign`:

| URL                           | Detected `__BASENAME__` | Correct `__BASENAME__` |
| ----------------------------- | ----------------------- | ---------------------- |
| `/marketing/campaign/`        | `/marketing` ❌         | `/marketing/campaign`  |
| `/marketing/campaign/pricing` | `/marketing` ❌         | `/marketing/campaign`  |

The detected basename is wrong, breaking all routing:

1. Router strips `/marketing` from `/marketing/campaign/pricing`
2. Sees `/campaign/pricing` as the route
3. No route matches → 404 or blank page

## The Full Request Flow

Here's the complete flow for a successful subpath request:

```
1. User visits: https://example.launch10.site/bingo/pricing

2. Atlas Worker:
   - Receives request for /bingo/pricing
   - Finds WebsiteUrl with path="/bingo" (longest match)
   - Strips "/bingo" → looks for "/pricing/index.html"
   - Fetches from R2: "production/{website_id}/live/pricing/index.html"
   - Returns index.html

3. Browser receives index.html:
   <script>window.__BASENAME__ = '/bingo';</script>
   <script src="./assets/app.js"></script>

4. Browser resolves relative path:
   - Current URL: /bingo/pricing (directory is /bingo/)
   - ./assets/app.js → /bingo/assets/app.js

5. Browser requests: /bingo/assets/app.js

6. Atlas Worker:
   - Finds WebsiteUrl with path="/bingo"
   - Strips "/bingo" → looks for "/assets/app.js"
   - Fetches from R2: "production/{website_id}/live/assets/app.js"
   - Returns JavaScript file

7. React app initializes:
   - BrowserRouter with basename="/bingo"
   - Current pathname: /bingo/pricing
   - After stripping basename: /pricing
   - Matches <Route path="/pricing" /> ✅

8. Page renders correctly!
```

## Alternative: Build-Time Basename Injection

To support multi-level paths, we would need to inject the basename at build time.

### Option A: Environment Variable

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    "import.meta.env.VITE_BASENAME": JSON.stringify(process.env.BASENAME || "/"),
  },
});
```

```tsx
// App.tsx
<BrowserRouter basename={import.meta.env.VITE_BASENAME}>
```

Rails would need to:

1. Know the WebsiteUrl path before building
2. Set `BASENAME=/marketing/campaign` environment variable
3. Run `pnpm build`

**Downside**: Requires rebuild if the path changes.

### Option B: HTML Injection at Deploy Time

Instead of building the basename into JS, inject it into the HTML when uploading to R2:

```html
<!-- Before upload, Rails modifies index.html -->
<script>
  window.__BASENAME__ = "/marketing/campaign";
</script>
```

**Downside**: More complex deploy pipeline, need to parse/modify HTML.

### Option C: Server-Side Rendering

Use SSR to inject the correct basename based on the request URL.

**Downside**: Requires Node.js runtime, not just static file serving.

## Current Constraints Summary

| Constraint                            | Reason                                                 |
| ------------------------------------- | ------------------------------------------------------ |
| Paths must start with `/`             | Consistency, URL standards                             |
| Paths must be single-level            | Runtime basename detection only extracts first segment |
| Subpaths redirect to trailing slash   | Ensures relative asset paths resolve correctly         |
| Each website needs unique domain+path | Database constraint, routing requirement               |

## Files Involved

| File                                      | Purpose                                                 |
| ----------------------------------------- | ------------------------------------------------------- |
| `rails_app/app/models/website_url.rb`     | Validates single-level paths, normalizes path format    |
| `rails_app/templates/default/index.html`  | Runtime `__BASENAME__` detection script                 |
| `rails_app/templates/default/src/App.tsx` | Passes `__BASENAME__` to BrowserRouter                  |
| `atlas/src/index-public.tsx`              | Trailing slash redirect, path stripping, R2 file lookup |
| `atlas/src/models/website-url.ts`         | Longest-path-match algorithm for WebsiteUrl lookup      |

## Future Improvements

1. **Build-time injection**: If multi-level paths become necessary, implement Option A or B above.

2. **Path validation in Atlas**: Currently Atlas trusts the WebsiteUrl paths. Could add validation there too.

3. **Canonical URL handling**: Consider adding `<link rel="canonical">` to help with SEO when redirecting.

4. **Preview deployments**: The same system works for preview URLs (`preview.example.launch10.site/bingo/`).
