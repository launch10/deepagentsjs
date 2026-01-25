import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * ROUTE INSTRUMENTATION AUDIT - BILLING CRITICAL
 *
 * Statically analyzes route handlers and annotation files to ensure
 * billing/usage tracking is properly configured.
 *
 * ARCHITECTURE:
 * - Bridges are defined in annotation files using createAppBridge
 * - createAppBridge has usageTrackingMiddleware baked in
 * - API files bind bridges to compiled graphs
 * - Routes use the Graph APIs (BrainstormAPI, WebsiteAPI, AdsAPI, DeployAPI)
 */

describe.sequential("Route Instrumentation Audit - BILLING CRITICAL", () => {
  const routesDir = path.join(process.cwd(), "app/server/routes");
  const apiDir = path.join(process.cwd(), "app/api");
  const annotationDir = path.join(process.cwd(), "app/annotation");

  /**
   * Check if the middleware file has usage tracking properly configured.
   */
  function middlewareHasTracking(): boolean {
    const middlewarePath = path.join(apiDir, "middleware", "usageTracking.ts");
    if (!fs.existsSync(middlewarePath)) {
      return false;
    }
    const content = fs.readFileSync(middlewarePath, "utf-8");
    return (
      content.includes("usageTrackingMiddleware") &&
      content.includes("createStorageMiddleware") &&
      content.includes("usageStorage") &&
      content.includes("persistTrace") &&
      content.includes("persistUsage") &&
      content.includes("createAppBridge")
    );
  }

  /**
   * Check if an annotation file defines a bridge using createAppBridge.
   */
  function annotationUsesAppBridge(annotationFile: string): boolean {
    const filePath = path.join(annotationDir, annotationFile);
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return content.includes("createAppBridge");
  }

  describe("API middleware MUST have usage tracking", () => {
    it("middleware/usageTracking.ts MUST export createAppBridge with usageTrackingMiddleware", () => {
      const hasTracking = middlewareHasTracking();

      expect(hasTracking).toBe(true);

      if (!hasTracking) {
        throw new Error(
          `BILLING CRITICAL: API middleware does not include usage tracking!\n\n` +
            `The app/api/middleware/usageTracking.ts must:\n` +
            `  1. Define usageTrackingMiddleware using createStorageMiddleware\n` +
            `  2. Use usageStorage, persistTrace, persistUsage from @core/billing\n` +
            `  3. Export createAppBridge with the middleware baked in\n\n` +
            `FIX: Ensure all required components are in place.`
        );
      }
    });
  });

  describe("Annotation files MUST use createAppBridge for bridges", () => {
    const annotations = [
      { file: "brainstormAnnotation.ts", bridge: "BrainstormBridge" },
      { file: "websiteAnnotation.ts", bridge: "WebsiteBridge" },
      { file: "adsAnnotation.ts", bridge: "AdsBridge" },
      { file: "deployAnnotation.ts", bridge: "DeployBridge" },
    ];

    for (const { file, bridge } of annotations) {
      it(`${file} MUST use createAppBridge for ${bridge}`, () => {
        const usesAppBridge = annotationUsesAppBridge(file);

        expect(usesAppBridge).toBe(true);

        if (!usesAppBridge) {
          throw new Error(
            `BILLING CRITICAL: ${file} does not use createAppBridge!\n\n` +
              `${bridge} must be created with createAppBridge to get\n` +
              `automatic usage tracking middleware.\n\n` +
              `FIX: Import createAppBridge from @api/middleware and use it.`
          );
        }
      });
    }
  });

  describe("Routes MUST use Graph APIs", () => {
    const graphRoutes = [
      { file: "brainstorm.ts", api: "BrainstormAPI" },
      { file: "website.ts", api: "WebsiteAPI" },
      { file: "ads.ts", api: "AdsAPI" },
      { file: "deploy.ts", api: "DeployAPI" },
    ];

    for (const { file, api } of graphRoutes) {
      it(`${file} MUST use ${api} for billing coverage`, () => {
        const filePath = path.join(routesDir, file);

        if (!fs.existsSync(filePath)) {
          return; // Route doesn't exist yet
        }

        const content = fs.readFileSync(filePath, "utf-8");
        const usesExpectedAPI = content.includes(api);

        expect(usesExpectedAPI).toBe(true);

        if (!usesExpectedAPI) {
          throw new Error(
            `BILLING CRITICAL: ${file} does not use ${api}!\n\n` +
              `Route should use ${api}.stream() for automatic billing.\n\n` +
              `FIX: Import and use ${api} from @api.`
          );
        }
      });
    }
  });

  describe("Comprehensive route scan", () => {
    it("ALL route files importing graphs MUST use Graph APIs", () => {
      const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts"));
      const violations: Array<{ file: string; reason: string }> = [];

      const hasMiddlewareTracking = middlewareHasTracking();

      for (const file of routeFiles) {
        const filePath = path.join(routesDir, file);
        const content = fs.readFileSync(filePath, "utf-8");

        const importsFromGraphs = content.includes("@graphs");
        if (!importsFromGraphs) continue;

        const usesGraphAPI =
          content.includes("BrainstormAPI") ||
          content.includes("WebsiteAPI") ||
          content.includes("AdsAPI") ||
          content.includes("DeployAPI");

        const usesDirectGraphCall =
          content.includes("graph.invoke") ||
          content.includes("graph.stream") ||
          content.includes("graph.streamEvents") ||
          content.includes("compiledGraph.stream") ||
          content.includes("compiledGraph.invoke");

        if (usesGraphAPI && hasMiddlewareTracking) {
          continue; // Covered by middleware
        }

        if (usesDirectGraphCall) {
          violations.push({
            file,
            reason: "Direct graph calls bypass billing. Use Graph API instead.",
          });
        }
      }

      if (violations.length > 0) {
        const violationList = violations.map((v) => `  - ${v.file}: ${v.reason}`).join("\n");

        throw new Error(
          `BILLING CRITICAL: Routes with untracked LLM usage!\n\n` +
            `${violationList}\n\n` +
            `These routes are giving away FREE LLM calls!\n\n` +
            `FIX: Use the appropriate Graph API (e.g., BrainstormAPI, DeployAPI).`
        );
      }
    });
  });
});
