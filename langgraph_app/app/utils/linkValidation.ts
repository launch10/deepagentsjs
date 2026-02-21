/**
 * Link Validation Utilities
 *
 * Shared validation logic for checking links in generated code files.
 * Used by both website graph (for retry-based fixing) and deploy graph (for pre-deploy validation).
 */

export interface ValidationError {
  file: string;
  message: string;
}

export type LinkType = "anchor" | "route" | "skip";

export function getLinkType(href: string): LinkType {
  if (href.startsWith("#")) return "anchor";
  if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:"))
    return "skip";
  // Skip static asset references (e.g. /favicon.ico, ./styles.css, /logo.png)
  const pathPart = href.split(/[?#]/)[0] || "";
  if (/\.\w+$/.test(pathPart)) return "skip";
  return "route";
}

export function collectAnchors(files: { path: string; content: string }[]): Set<string> {
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

export function parseRoutes(files: { path: string; content: string }[]): Set<string> {
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

export function validateLinks(files: { path: string; content: string }[]): ValidationError[] {
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
            message: `Broken anchor: ${href} - no element with id="${id}". If this is a real section, add the missing id. If this is an invented section (e.g. careers, blog, privacy), remove the link.`,
          });
        }
      } else if (linkType === "route") {
        const [pathPart] = href.split(/[?#]/);
        const normalized = (pathPart || "").replace(/\/$/, "") || "/";
        if (!routes.has(normalized)) {
          errors.push({
            file: file.path,
            message: `No route for: ${href} - if this page exists, add a <Route> for it. If this is an invented page (e.g. /about, /blog, /careers), remove the link instead.`,
          });
        }
      }
    }
  }

  return errors;
}
