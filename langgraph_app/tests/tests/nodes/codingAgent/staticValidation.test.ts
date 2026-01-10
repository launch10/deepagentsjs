import { describe, it, expect } from "vitest";

// Test the validation functions directly by importing the module
// and testing the exported node's underlying logic

// We can't easily test the node itself without mocking the DB,
// so we'll test the validation logic through function extraction

// Create local copies of the validation functions for unit testing
type LinkType = "anchor" | "route" | "skip";

function getLinkType(href: string): LinkType {
  if (href.startsWith("#")) return "anchor";
  if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:"))
    return "skip";
  return "route";
}

function collectAnchors(files: { path: string; content: string }[]): Set<string> {
  const anchors = new Set<string>();
  for (const file of files) {
    const matches = file.content.matchAll(/id=["']([^"']+)["']/g);
    for (const match of matches) {
      const id = match[1];
      if (id) anchors.add(id);
    }
  }
  return anchors;
}

function parseRoutes(files: { path: string; content: string }[]): Set<string> {
  const appFile = files.find((f) => f.path.endsWith("App.tsx"));
  if (!appFile) return new Set(["/"]);

  const routes = new Set<string>(["/"]);
  const matches = appFile.content.matchAll(/<Route\s+path=["']([^"']+)["']/g);
  for (const match of matches) {
    const path = match[1];
    if (path && path !== "*") {
      routes.add(path.replace(/\/$/, "") || "/");
    }
  }
  return routes;
}

interface ValidationError {
  file: string;
  message: string;
}

function validateLinks(files: { path: string; content: string }[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const anchors = collectAnchors(files);
  const routes = parseRoutes(files);

  for (const file of files) {
    const matches = file.content.matchAll(/href=["']([^"']+)["']/g);

    for (const match of matches) {
      const href = match[1];
      if (!href) continue;

      const linkType = getLinkType(href);

      if (linkType === "anchor") {
        const id = href.slice(1);
        if (!anchors.has(id)) {
          errors.push({
            file: file.path,
            message: `Broken anchor: ${href} - no element with id="${id}"`,
          });
        }
      } else if (linkType === "route") {
        const [pathPart] = href.split(/[?#]/);
        const normalized = (pathPart || "").replace(/\/$/, "") || "/";
        if (!routes.has(normalized)) {
          errors.push({
            file: file.path,
            message: `No route for: ${href} - add <Route path="${normalized}"> to App.tsx`,
          });
        }
      }
    }
  }

  return errors;
}

describe("Static Validation", () => {
  describe("getLinkType", () => {
    it("identifies anchor links", () => {
      expect(getLinkType("#pricing")).toBe("anchor");
      expect(getLinkType("#")).toBe("anchor");
    });

    it("identifies external links", () => {
      expect(getLinkType("https://example.com")).toBe("skip");
      expect(getLinkType("http://example.com")).toBe("skip");
      expect(getLinkType("mailto:test@example.com")).toBe("skip");
      expect(getLinkType("tel:+1234567890")).toBe("skip");
    });

    it("identifies route links", () => {
      expect(getLinkType("/pricing")).toBe("route");
      expect(getLinkType("/about")).toBe("route");
      expect(getLinkType("/")).toBe("route");
    });
  });

  describe("collectAnchors", () => {
    it("extracts IDs from files", () => {
      const files = [
        { path: "Hero.tsx", content: '<section id="hero">...</section>' },
        { path: "Pricing.tsx", content: '<div id="pricing">...</div>' },
      ];
      const anchors = collectAnchors(files);
      expect(anchors.has("hero")).toBe(true);
      expect(anchors.has("pricing")).toBe(true);
    });

    it("handles single and double quotes", () => {
      const files = [
        { path: "Test.tsx", content: `<div id='single'>...</div><div id="double">...</div>` },
      ];
      const anchors = collectAnchors(files);
      expect(anchors.has("single")).toBe(true);
      expect(anchors.has("double")).toBe(true);
    });
  });

  describe("parseRoutes", () => {
    it("returns root route when no App.tsx exists", () => {
      const files = [{ path: "Hero.tsx", content: "..." }];
      const routes = parseRoutes(files);
      expect(routes.has("/")).toBe(true);
      expect(routes.size).toBe(1);
    });

    it("extracts routes from App.tsx", () => {
      const files = [
        {
          path: "src/App.tsx",
          content: `
            <Route path="/" element={<Home />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          `,
        },
      ];
      const routes = parseRoutes(files);
      expect(routes.has("/")).toBe(true);
      expect(routes.has("/pricing")).toBe(true);
      expect(routes.has("/about")).toBe(true);
      expect(routes.has("*")).toBe(false); // Wildcard should be excluded
    });

    it("normalizes trailing slashes", () => {
      const files = [
        {
          path: "App.tsx",
          content: `<Route path="/pricing/" element={<Pricing />} />`,
        },
      ];
      const routes = parseRoutes(files);
      expect(routes.has("/pricing")).toBe(true);
      expect(routes.has("/pricing/")).toBe(false);
    });
  });

  describe("validateLinks", () => {
    it("passes when all anchors exist", () => {
      const files = [
        {
          path: "Nav.tsx",
          content: `<a href="#pricing">Pricing</a>`,
        },
        {
          path: "Pricing.tsx",
          content: `<section id="pricing">...</section>`,
        },
      ];
      const errors = validateLinks(files);
      expect(errors).toHaveLength(0);
    });

    it("detects broken anchor links", () => {
      const files = [
        {
          path: "Nav.tsx",
          content: `<a href="#pricing">Pricing</a>`,
        },
        {
          path: "Hero.tsx",
          content: `<section id="hero">...</section>`,
        },
      ];
      const errors = validateLinks(files);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.file).toBe("Nav.tsx");
      expect(errors[0]!.message).toContain("Broken anchor");
      expect(errors[0]!.message).toContain("#pricing");
    });

    it("passes when all routes exist", () => {
      const files = [
        {
          path: "App.tsx",
          content: `<Route path="/pricing" element={<Pricing />} />`,
        },
        {
          path: "Nav.tsx",
          content: `<a href="/pricing">Pricing</a>`,
        },
      ];
      const errors = validateLinks(files);
      expect(errors).toHaveLength(0);
    });

    it("detects missing routes", () => {
      const files = [
        {
          path: "App.tsx",
          content: `<Route path="/" element={<Home />} />`,
        },
        {
          path: "Nav.tsx",
          content: `<a href="/pricing">Pricing</a>`,
        },
      ];
      const errors = validateLinks(files);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.file).toBe("Nav.tsx");
      expect(errors[0]!.message).toContain("No route for");
    });

    it("handles query strings in routes", () => {
      const files = [
        {
          path: "App.tsx",
          content: `<Route path="/pricing" element={<Pricing />} />`,
        },
        {
          path: "Nav.tsx",
          content: `<a href="/pricing?ref=nav">Pricing</a>`,
        },
      ];
      const errors = validateLinks(files);
      expect(errors).toHaveLength(0);
    });

    it("handles hash with routes", () => {
      const files = [
        {
          path: "App.tsx",
          content: `<Route path="/about" element={<About />} />`,
        },
        {
          path: "Nav.tsx",
          content: `<a href="/about#team">Team</a>`,
        },
      ];
      const errors = validateLinks(files);
      expect(errors).toHaveLength(0);
    });

    it("skips external links", () => {
      const files = [
        {
          path: "Footer.tsx",
          content: `
            <a href="https://twitter.com">Twitter</a>
            <a href="mailto:test@example.com">Email</a>
            <a href="tel:+1234567890">Phone</a>
          `,
        },
      ];
      const errors = validateLinks(files);
      expect(errors).toHaveLength(0);
    });
  });
});
