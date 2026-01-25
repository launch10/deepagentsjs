import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * ROUTE INSTRUMENTATION AUDIT - BILLING CRITICAL
 *
 * These tests statically analyze our route handlers and bridges to ensure
 * billing/usage tracking is properly configured.
 *
 * This is a safeguard to ensure no new routes bypass billing.
 *
 * ARCHITECTURE:
 * - ALL graphs use the Bridge pattern via createAppBridge
 * - Bridges have usage tracking middleware baked in
 * - Routes use the Bridge APIs (BrainstormAPI, WebsiteAPI, AdsAPI, DeployAPI)
 * - Middleware is defined in app/bridges/middleware/usageTracking.ts
 */

describe("Route Instrumentation Audit - BILLING CRITICAL", () => {
  const routesDir = path.join(process.cwd(), "app/server/routes");
  const bridgesDir = path.join(process.cwd(), "app/bridges");
  const annotationDir = path.join(process.cwd(), "app/annotation");

  /**
   * Check if the bridge factory has usage tracking middleware.
   */
  function bridgeFactoryHasTracking(): boolean {
    const factoryPath = path.join(bridgesDir, "factory.ts");
    if (!fs.existsSync(factoryPath)) {
      return false;
    }
    const content = fs.readFileSync(factoryPath, "utf-8");
    return content.includes("usageTrackingMiddleware");
  }

  /**
   * Check if the usage middleware exists and is properly configured.
   */
  function usageMiddlewareExists(): boolean {
    const middlewarePath = path.join(bridgesDir, "middleware", "usageTracking.ts");
    if (!fs.existsSync(middlewarePath)) {
      return false;
    }
    const content = fs.readFileSync(middlewarePath, "utf-8");
    return (
      content.includes("createStorageMiddleware") &&
      content.includes("usageStorage") &&
      content.includes("persistTrace") &&
      content.includes("persistUsage")
    );
  }

  /**
   * Check if an annotation file uses createAppBridge (tracked).
   */
  function annotationUsesAppBridge(annotationFile: string): boolean {
    const filePath = path.join(annotationDir, annotationFile);
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return content.includes("createAppBridge");
  }

  describe("Bridge Factory MUST have usage tracking middleware", () => {
    it("createAppBridge factory MUST include usageTrackingMiddleware", () => {
      const hasTracking = bridgeFactoryHasTracking();

      expect(hasTracking).toBe(true);

      if (!hasTracking) {
        throw new Error(
          `BILLING CRITICAL: Bridge factory does not include usage tracking middleware!\n\n` +
            `The createAppBridge factory in app/bridges/factory.ts must include\n` +
            `usageTrackingMiddleware for automatic billing on all graph streams.\n\n` +
            `FIX: Import and add usageTrackingMiddleware to the middleware array.`
        );
      }
    });

    it("usageTrackingMiddleware MUST be properly configured", () => {
      const exists = usageMiddlewareExists();

      expect(exists).toBe(true);

      if (!exists) {
        throw new Error(
          `BILLING CRITICAL: Usage tracking middleware is missing or misconfigured!\n\n` +
            `The app/bridges/middleware/usageTracking.ts must:\n` +
            `  1. Use createStorageMiddleware from the SDK\n` +
            `  2. Use usageStorage from @core/usage\n` +
            `  3. Call persistTrace and persistUsage on completion\n\n` +
            `FIX: Ensure all required components are in place.`
        );
      }
    });
  });

  describe("Annotation files MUST use createAppBridge", () => {
    const annotationBridges = [
      { file: "brainstormAnnotation.ts", bridge: "BrainstormBridge" },
      { file: "websiteAnnotation.ts", bridge: "WebsiteBridge" },
      { file: "adsAnnotation.ts", bridge: "AdsBridge" },
      { file: "deployAnnotation.ts", bridge: "DeployBridge" },
    ];

    for (const { file, bridge } of annotationBridges) {
      it(`${file} MUST use createAppBridge for ${bridge}`, () => {
        const usesAppBridge = annotationUsesAppBridge(file);

        expect(usesAppBridge).toBe(true);

        if (!usesAppBridge) {
          throw new Error(
            `BILLING CRITICAL: ${file} does not use createAppBridge!\n\n` +
              `${bridge} must be created with createAppBridge to get\n` +
              `automatic usage tracking middleware.\n\n` +
              `Currently using raw createBridge which bypasses billing.\n\n` +
              `FIX: Import createAppBridge from @bridges and use it instead of createBridge.`
          );
        }
      });
    }
  });

  describe("Route-level tracking requirements", () => {
    // All routes should use Bridge APIs for automatic tracking
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
          // Route doesn't exist yet - skip
          return;
        }

        const content = fs.readFileSync(filePath, "utf-8");

        // Route should use the Bridge API
        const usesExpectedAPI = content.includes(api);

        expect(usesExpectedAPI).toBe(true);

        if (!usesExpectedAPI) {
          throw new Error(
            `BILLING CRITICAL: ${file} does not use ${api}!\n\n` +
              `Route should use ${api}.stream() for automatic billing.\n\n` +
              `FIX: Import and use ${api} from @graphs.`
          );
        }
      });
    }
  });

  describe("Comprehensive route scan", () => {
    it("ALL route files importing graphs MUST use Bridge APIs", () => {
      const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts"));
      const violations: Array<{ file: string; reason: string }> = [];

      // Check that bridge factory has tracking
      const factoryHasTracking = bridgeFactoryHasTracking();

      for (const file of routeFiles) {
        const filePath = path.join(routesDir, file);
        const content = fs.readFileSync(filePath, "utf-8");

        // Check if file imports from @graphs
        const importsFromGraphs = content.includes("@graphs");

        if (!importsFromGraphs) continue;

        // Check for Bridge API usage (middleware-based tracking)
        const usesBridgeAPI =
          content.includes("BrainstormAPI") ||
          content.includes("WebsiteAPI") ||
          content.includes("AdsAPI") ||
          content.includes("DeployAPI");

        // Check for direct graph calls (bypasses billing)
        const usesDirectGraphCall =
          content.includes("graph.invoke") ||
          content.includes("graph.stream") ||
          content.includes("graph.streamEvents") ||
          content.includes("compiledGraph.stream") ||
          content.includes("compiledGraph.invoke");

        // Bridge API usage is OK if factory has tracking
        if (usesBridgeAPI && factoryHasTracking) {
          continue; // Covered by middleware
        }

        // Direct graph calls = violation (should use Bridge API)
        if (usesDirectGraphCall) {
          violations.push({
            file,
            reason: "Direct graph calls bypass billing. Use Bridge API instead.",
          });
        }

        // Imports @graphs but doesn't use Bridge API = suspicious
        if (!usesBridgeAPI && !usesDirectGraphCall) {
          // Might be importing types or something else - not necessarily a violation
          // but worth noting
        }
      }

      if (violations.length > 0) {
        const violationList = violations.map((v) => `  - ${v.file}: ${v.reason}`).join("\n");

        throw new Error(
          `BILLING CRITICAL: Routes with untracked LLM usage!\n\n` +
            `${violationList}\n\n` +
            `These routes are giving away FREE LLM calls!\n\n` +
            `FIX: Use the appropriate Bridge API (e.g., BrainstormAPI, DeployAPI) instead of direct graph calls.`
        );
      }
    });
  });
});
