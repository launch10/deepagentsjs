import { describe, it, expect } from "vitest";
import { checkSEOElements, countSEOElements } from "@nodes";
import { isInfrastructureError } from "@nodes";

/**
 * =============================================================================
 * checkSEOElements / countSEOElements
 *
 * Pure functions extracted from seoOptimizationNode that check HTML content
 * for 7 key SEO elements (title, meta description, og:title, og:description,
 * og:image, twitter:card, favicon). SEO is considered "done" when >= 5 are present.
 * =============================================================================
 */
describe("checkSEOElements", () => {
  /** Helper to build a minimal HTML document with the specified SEO tags */
  function buildHtml(tags: string[]): string {
    return `<!DOCTYPE html>
<html>
<head>
  ${tags.join("\n  ")}
</head>
<body><h1>Hello</h1></body>
</html>`;
  }

  // ---- All seven elements ----
  const ALL_TAGS = [
    `<title>My Landing Page</title>`,
    `<meta name="description" content="A great landing page for your business">`,
    `<meta property="og:title" content="My Landing Page">`,
    `<meta property="og:description" content="A great landing page">`,
    `<meta property="og:image" content="https://example.com/image.png">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="icon" href="/favicon.ico" type="image/x-icon">`,
  ];

  describe("all elements present (7/7)", () => {
    it("returns true", () => {
      const html = buildHtml(ALL_TAGS);
      expect(checkSEOElements(html)).toBe(true);
    });

    it("counts 7 elements", () => {
      const html = buildHtml(ALL_TAGS);
      expect(countSEOElements(html)).toBe(7);
    });
  });

  describe("exactly 5 elements present (threshold)", () => {
    it("returns true with title + meta description + og:title + og:description + twitter:card", () => {
      const html = buildHtml([
        `<title>My Page</title>`,
        `<meta name="description" content="Page description here">`,
        `<meta property="og:title" content="My Page">`,
        `<meta property="og:description" content="Page description">`,
        `<meta name="twitter:card" content="summary_large_image">`,
      ]);
      expect(checkSEOElements(html)).toBe(true);
      expect(countSEOElements(html)).toBe(5);
    });

    it("returns true with og:image and favicon replacing og:description and twitter:card", () => {
      const html = buildHtml([
        `<title>My Page</title>`,
        `<meta name="description" content="Page description here">`,
        `<meta property="og:title" content="My Page">`,
        `<meta property="og:image" content="https://example.com/img.png">`,
        `<link rel="icon" href="/favicon.ico">`,
      ]);
      expect(checkSEOElements(html)).toBe(true);
      expect(countSEOElements(html)).toBe(5);
    });
  });

  describe("only 4 elements present (below threshold)", () => {
    it("returns false with title + meta description + og:title + og:description only", () => {
      const html = buildHtml([
        `<title>My Page</title>`,
        `<meta name="description" content="Page description here">`,
        `<meta property="og:title" content="My Page">`,
        `<meta property="og:description" content="Page description">`,
      ]);
      expect(checkSEOElements(html)).toBe(false);
      expect(countSEOElements(html)).toBe(4);
    });
  });

  describe("no SEO elements", () => {
    it("returns false for bare HTML", () => {
      const html = `<!DOCTYPE html><html><head></head><body>Hello</body></html>`;
      expect(checkSEOElements(html)).toBe(false);
      expect(countSEOElements(html)).toBe(0);
    });
  });

  describe("empty or minimal content", () => {
    it("returns false for empty string", () => {
      expect(checkSEOElements("")).toBe(false);
      expect(countSEOElements("")).toBe(0);
    });

    it("returns false for whitespace-only content", () => {
      expect(checkSEOElements("   \n\t  ")).toBe(false);
    });
  });

  describe("meta description format variants", () => {
    it("detects name-first format: <meta name='description' content='...'>", () => {
      const html = buildHtml([
        `<title>Test</title>`,
        `<meta name="description" content="Some description">`,
        `<meta property="og:title" content="Test">`,
        `<meta property="og:description" content="Test">`,
        `<meta name="twitter:card" content="summary">`,
      ]);
      expect(checkSEOElements(html)).toBe(true);
    });

    it("detects content-first format: <meta content='...' name='description'>", () => {
      const html = buildHtml([
        `<title>Test</title>`,
        `<meta content="Some description" name="description">`,
        `<meta property="og:title" content="Test">`,
        `<meta property="og:description" content="Test">`,
        `<meta name="twitter:card" content="summary">`,
      ]);
      expect(checkSEOElements(html)).toBe(true);
    });

    it("detects single-quoted attributes", () => {
      const html = buildHtml([
        `<title>Test</title>`,
        `<meta name='description' content='Some description'>`,
        `<meta property='og:title' content='Test'>`,
        `<meta property='og:description' content='Test'>`,
        `<meta name='twitter:card' content='summary'>`,
      ]);
      expect(checkSEOElements(html)).toBe(true);
    });
  });

  describe("favicon variants", () => {
    it("detects rel='icon'", () => {
      const html = buildHtml([
        `<title>Test</title>`,
        `<meta name="description" content="Desc">`,
        `<meta property="og:title" content="T">`,
        `<meta property="og:description" content="D">`,
        `<link rel="icon" href="/favicon.ico">`,
      ]);
      expect(countSEOElements(html)).toBe(5);
    });

    it("detects rel='shortcut icon'", () => {
      const html = buildHtml([
        `<title>Test</title>`,
        `<meta name="description" content="Desc">`,
        `<meta property="og:title" content="T">`,
        `<meta property="og:description" content="D">`,
        `<link rel="shortcut icon" href="/favicon.ico">`,
      ]);
      expect(countSEOElements(html)).toBe(5);
    });
  });

  describe("title edge cases", () => {
    it("does not match empty title tags", () => {
      const html = buildHtml([
        `<title></title>`,
        `<meta name="description" content="Desc">`,
        `<meta property="og:title" content="T">`,
        `<meta property="og:description" content="D">`,
        `<meta name="twitter:card" content="summary">`,
      ]);
      // Empty <title> should NOT count as having a title (regex requires [^<]+)
      expect(countSEOElements(html)).toBe(4);
      expect(checkSEOElements(html)).toBe(false);
    });
  });
});

/**
 * =============================================================================
 * isInfrastructureError
 *
 * Checks if an error message matches known Playwright infrastructure errors
 * (browser closed, protocol errors, etc.) as opposed to user code bugs.
 * =============================================================================
 */
describe("isInfrastructureError", () => {
  describe("infrastructure errors (should return true)", () => {
    it('detects "Target page, context or browser has been closed"', () => {
      expect(isInfrastructureError("Target page, context or browser has been closed")).toBe(true);
    });

    it('detects "browser has been closed"', () => {
      expect(isInfrastructureError("browser has been closed")).toBe(true);
    });

    it('detects "Protocol error"', () => {
      expect(isInfrastructureError("Protocol error (Runtime.callFunctionOn): Session closed.")).toBe(
        true
      );
    });

    it('detects "Navigation failed because page was closed"', () => {
      expect(isInfrastructureError("Navigation failed because page was closed")).toBe(true);
    });

    it('detects "frame was detached"', () => {
      expect(isInfrastructureError("frame was detached")).toBe(true);
    });

    it('detects "Execution context was destroyed"', () => {
      expect(isInfrastructureError("Execution context was destroyed")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(isInfrastructureError("PROTOCOL ERROR")).toBe(true);
      expect(isInfrastructureError("Frame Was Detached")).toBe(true);
    });

    it("detects patterns embedded in longer messages", () => {
      expect(
        isInfrastructureError(
          "Error: Protocol error (Runtime.callFunctionOn): Target closed."
        )
      ).toBe(true);
    });
  });

  describe("user code errors (should return false)", () => {
    it('rejects "TypeError: cannot read property"', () => {
      expect(
        isInfrastructureError("TypeError: Cannot read properties of undefined (reading 'map')")
      ).toBe(false);
    });

    it('rejects "ReferenceError: foo is not defined"', () => {
      expect(isInfrastructureError("ReferenceError: foo is not defined")).toBe(false);
    });

    it('rejects "SyntaxError: Unexpected token"', () => {
      expect(isInfrastructureError("SyntaxError: Unexpected token <")).toBe(false);
    });

    it("rejects generic application errors", () => {
      expect(isInfrastructureError("Failed to fetch data from API")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isInfrastructureError("")).toBe(false);
    });

    it("rejects partial matches that are not real infra errors", () => {
      // "frame" alone should not match — it needs "frame was detached"
      expect(isInfrastructureError("frame loaded successfully")).toBe(false);
    });
  });
});
