/**
 * Prerender script — runs after `vite build` to generate static HTML
 * for each route. Discovers routes automatically from src/pages/*Page.tsx
 * filenames instead of requiring a manually maintained route list.
 *
 * Convention:
 *   IndexPage.tsx    → /
 *   NotFoundPage.tsx → skipped
 *   PricingPage.tsx  → /pricing
 *   AboutUsPage.tsx  → /about-us
 *
 * Uses Vite's SSR module loading — no headless browser needed.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.resolve(root, "dist");
const pagesDir = path.resolve(root, "src", "pages");

/**
 * Convert PascalCase page filename to a URL route.
 *   IndexPage.tsx    → /
 *   NotFoundPage.tsx → null (skipped)
 *   PricingPage.tsx  → /pricing
 *   AboutUsPage.tsx  → /about-us
 */
function filenameToRoute(filename) {
  const name = filename.replace(/Page\.tsx$/, "");

  if (name === "Index") return "/";
  if (name === "NotFound") return null;

  // PascalCase → kebab-case: "AboutUs" → "about-us"
  const kebab = name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();

  return `/${kebab}`;
}

/**
 * Discover routes by scanning src/pages/*Page.tsx files.
 */
function discoverRoutes() {
  if (!fs.existsSync(pagesDir)) return ["/"];

  const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith("Page.tsx"));
  const routes = files
    .map(filenameToRoute)
    .filter((route) => route !== null);

  // Always include "/" even if no IndexPage.tsx found
  if (!routes.includes("/")) routes.unshift("/");

  return routes;
}

async function prerender() {
  const routes = discoverRoutes();
  console.log(`\n  Discovered ${routes.length} route(s): ${routes.join(", ")}`);

  // Spin up Vite in SSR mode (no HTTP server)
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "warn",
  });

  const rendered = [];

  try {
    const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");

    // Read the client-built index.html as the shell template
    const template = fs.readFileSync(
      path.resolve(distDir, "index.html"),
      "utf-8"
    );

    for (const route of routes) {
      try {
        const appHtml = render(route);

        // Inject rendered HTML into the template
        const page = template.replace(
          '<div id="root"></div>',
          `<div id="root">${appHtml}</div>`
        );

        // Write to the appropriate path
        const filePath =
          route === "/"
            ? path.resolve(distDir, "index.html")
            : path.resolve(distDir, route.slice(1), "index.html");

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, page);
        rendered.push(route);
        console.log(`  Prerendered: ${route}`);
      } catch (err) {
        console.warn(`  Skipped ${route}: ${err.message}`);
      }
    }

    // Write manifest of prerendered routes for sitemap generation
    fs.writeFileSync(
      path.resolve(distDir, "prerendered-routes.json"),
      JSON.stringify(rendered, null, 2)
    );

    console.log(
      `\n  ${rendered.length}/${routes.length} routes prerendered successfully.\n`
    );
  } finally {
    await vite.close();
  }
}

prerender().catch((err) => {
  console.error("Prerender failed:", err);
  process.exit(1);
});
