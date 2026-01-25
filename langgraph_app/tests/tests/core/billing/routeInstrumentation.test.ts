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
 * - Bridges are created via `createAppBridge` which has usage tracking middleware
 * - Routes use the Bridge APIs (BrainstormAPI, WebsiteAPI, AdsAPI)
 * - Deploy graph uses `streamWithUsageTracking` directly
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

  /**
   * Check if a route file has tracking wrappers (for non-Bridge routes like deploy).
   */
  function hasDirectTrackingWrapper(content: string): boolean {
    return (
      content.includes("executeWithTracking") ||
      content.includes("runWithUsageTracking") ||
      content.includes("streamWithUsageTracking")
    );
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
            `The app/bridges/usageMiddleware.ts must:\n` +
            `  1. Use createStorageMiddleware from the SDK\n` +
            `  2. Use usageStorage from @core/billing\n` +
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
    const graphRoutes = [
      { file: "brainstorm.ts", bridge: "BrainstormAPI" },
      { file: "website.ts", bridge: "WebsiteAPI" },
      { file: "ads.ts", bridge: "AdsAPI" },
      { file: "deploy.ts", bridge: null }, // Uses direct graph, not bridge
    ];

    for (const { file, bridge } of graphRoutes) {
      it(`${file} MUST have billing coverage`, () => {
        const filePath = path.join(routesDir, file);

        if (!fs.existsSync(filePath)) {
          // Route doesn't exist yet - skip
          return;
        }

        const content = fs.readFileSync(filePath, "utf-8");

        if (bridge) {
          // Bridge-based routes get tracking from createAppBridge middleware
          // Verify the route uses the expected API
          const usesExpectedAPI =
            content.includes(bridge) || content.includes(`${bridge.replace("API", "")}API`);

          expect(usesExpectedAPI).toBe(true);

          if (!usesExpectedAPI) {
            throw new Error(
              `BILLING CRITICAL: ${file} does not use ${bridge}!\n\n` +
                `Route should use ${bridge}.stream() for automatic billing.\n\n` +
                `FIX: Import and use ${bridge} from @graphs.`
            );
          }
        } else {
          // Non-bridge routes (like deploy) need direct tracking wrapper
          const hasTracking = hasDirectTrackingWrapper(content);

          expect(hasTracking).toBe(true);

          if (!hasTracking) {
            throw new Error(
              `BILLING CRITICAL: ${file} has no tracking wrapper!\n\n` +
                `Routes using direct graph calls must wrap with:\n` +
                `  - executeWithTracking (for invoke)\n` +
                `  - streamWithUsageTracking (for stream)\n\n` +
                `FIX: Wrap graph execution with appropriate tracking function.`
            );
          }
        }
      });
    }
  });

  describe("Comprehensive route scan", () => {
    it("ALL route files importing graphs MUST have billing coverage", () => {
      const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts"));
      const violations: Array<{ file: string; reason: string }> = [];

      // Check that bridge factory has tracking
      const factoryHasTracking = bridgeFactoryHasTracking();

      for (const file of routeFiles) {
        const filePath = path.join(routesDir, file);
        const content = fs.readFileSync(filePath, "utf-8");

        // Check if file imports any graph
        const importsGraph =
          content.includes("@graphs") ||
          content.includes("brainstormGraph") ||
          content.includes("websiteGraph") ||
          content.includes("adsGraph") ||
          content.includes("deployGraph");

        if (!importsGraph) continue;

        const hasDirectTracking = hasDirectTrackingWrapper(content);

        // Check for Bridge API usage (middleware-based tracking)
        const usesBridgeAPI =
          content.includes("BrainstormAPI") ||
          content.includes("WebsiteAPI") ||
          content.includes("AdsAPI");

        const usesDirectGraphCall =
          content.includes("graph.invoke") ||
          content.includes("graph.stream") ||
          content.includes("graph.streamEvents") ||
          content.includes("compiledDeployGraph.stream") ||
          content.includes(".invoke(") ||
          (content.includes(".stream(") && !usesBridgeAPI);

        // Bridge API usage is OK if factory has tracking
        if (usesBridgeAPI && factoryHasTracking) {
          continue; // Covered by middleware
        }

        // Direct graph calls without tracking = violation
        if (usesDirectGraphCall && !hasDirectTracking) {
          violations.push({
            file,
            reason: "Direct graph calls without tracking wrapper",
          });
        }

        // Bridge API usage without factory tracking = violation
        if (usesBridgeAPI && !factoryHasTracking && !hasDirectTracking) {
          violations.push({
            file,
            reason: "Uses Bridge API but factory lacks tracking middleware",
          });
        }
      }

      if (violations.length > 0) {
        const violationList = violations.map((v) => `  - ${v.file}: ${v.reason}`).join("\n");

        throw new Error(
          `BILLING CRITICAL: Routes with untracked LLM usage!\n\n` +
            `${violationList}\n\n` +
            `These routes are giving away FREE LLM calls!`
        );
      }
    });
  });
});
