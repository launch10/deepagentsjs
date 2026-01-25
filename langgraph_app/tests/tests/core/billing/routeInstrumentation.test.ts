import { describe, it, expect, beforeAll } from "vitest";
import { Glob } from "bun";
import * as fs from "fs";
import * as path from "path";

/**
 * ROUTE INSTRUMENTATION AUDIT - BILLING CRITICAL
 *
 * These tests statically analyze our route handlers to ensure
 * they ALL use executeWithTracking or runWithUsageTracking.
 *
 * This is a safeguard to ensure no new routes bypass billing.
 *
 * If this test fails, it means there's a route that can execute
 * LLM calls without tracking usage - i.e., FREE LLM CALLS.
 */

describe("Route Instrumentation Audit - BILLING CRITICAL", () => {
  const routesDir = path.join(process.cwd(), "app/server/routes");
  const graphRoutes = ["brainstorm.ts", "website.ts", "ads.ts", "deploy.ts"];

  describe("All graph routes MUST use tracking", () => {
    for (const routeFile of graphRoutes) {
      it(`${routeFile} MUST use executeWithTracking or runWithUsageTracking`, () => {
        const filePath = path.join(routesDir, routeFile);
        const content = fs.readFileSync(filePath, "utf-8");

        const usesExecuteWithTracking = content.includes("executeWithTracking");
        const usesRunWithUsageTracking = content.includes("runWithUsageTracking");
        const usesBridgeStream = content.includes("Bridge.bind") || content.includes("API.stream");
        const usesDirectGraphInvoke =
          content.includes("graph.invoke") ||
          content.includes("graph.stream") ||
          content.includes("graph.streamEvents");

        // If using direct graph calls, MUST also use tracking
        if (usesDirectGraphInvoke && !usesExecuteWithTracking && !usesRunWithUsageTracking) {
          throw new Error(
            `${routeFile} uses direct graph invocation (graph.invoke/stream/streamEvents) ` +
              `without executeWithTracking or runWithUsageTracking. ` +
              `This means LLM calls in this route are NOT being tracked for billing!`
          );
        }

        // If using bridge pattern, verify tracking is integrated
        if (usesBridgeStream && !usesExecuteWithTracking && !usesRunWithUsageTracking) {
          // Check if bridge has tracking built-in (it currently doesn't!)
          const bridgeHasTracking = content.includes("withTracking") || content.includes("persist");

          if (!bridgeHasTracking) {
            throw new Error(
              `${routeFile} uses Bridge API pattern without tracking. ` +
                `The Bridge.stream() method bypasses executeWithTracking. ` +
                `LLM calls in this route are NOT being tracked for billing!`
            );
          }
        }
      });
    }
  });

  describe("SDK stream.ts MUST integrate tracking", () => {
    it("createLanggraphStreamResponse MUST wrap with tracking", () => {
      const sdkStreamPath = path.join(
        process.cwd(),
        "../packages/langgraph-ai-sdk/packages/langgraph-ai-sdk/src/stream.ts"
      );

      // Skip if SDK not accessible in test environment
      if (!fs.existsSync(sdkStreamPath)) {
        console.warn("SDK stream.ts not found - skipping");
        return;
      }

      const content = fs.readFileSync(sdkStreamPath, "utf-8");

      const usesExecuteWithTracking = content.includes("executeWithTracking");
      const usesRunWithUsageTracking = content.includes("runWithUsageTracking");

      if (!usesExecuteWithTracking && !usesRunWithUsageTracking) {
        throw new Error(
          `SDK stream.ts does not integrate usage tracking! ` +
            `createLanggraphStreamResponse calls graph.streamEvents() directly ` +
            `without wrapping in runWithUsageTracking. ` +
            `ALL routes using the Bridge pattern are NOT tracking usage!`
        );
      }
    });
  });

  describe("All routes importing graphs MUST use tracking", () => {
    it("scans all route files for untracked graph usage", async () => {
      const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts"));

      const violations: string[] = [];

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

        if (!importsGraph) continue; // Skip non-graph routes

        // Check for tracking
        const hasTracking =
          content.includes("executeWithTracking") ||
          content.includes("runWithUsageTracking") ||
          content.includes("withTracking");

        // Check for direct graph invocations
        const hasDirectInvoke =
          content.includes(".invoke(") ||
          content.includes(".stream(") ||
          content.includes(".streamEvents(");

        if (hasDirectInvoke && !hasTracking) {
          violations.push(file);
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `The following route files use graphs without tracking:\n` +
            violations.map((v) => `  - ${v}`).join("\n") +
            `\n\nThis means LLM calls are not being billed!`
        );
      }
    });
  });

  describe("Bridge pattern MUST have tracking built-in", () => {
    it("Bridge.bind() MUST integrate tracking in stream method", () => {
      const agentPath = path.join(
        process.cwd(),
        "../packages/langgraph-ai-sdk/packages/langgraph-ai-sdk/src/agent.ts"
      );

      if (!fs.existsSync(agentPath)) {
        console.warn("SDK agent.ts not found - skipping");
        return;
      }

      const content = fs.readFileSync(agentPath, "utf-8");

      // Find the stream method in bind()
      const streamMethodMatch = content.match(/stream\s*\([^)]*\)\s*\{[^}]*createLanggraphStreamResponse/);

      if (streamMethodMatch) {
        // Check if it wraps with tracking
        const usesTracking =
          content.includes("runWithUsageTracking") || content.includes("executeWithTracking");

        if (!usesTracking) {
          throw new Error(
            `Bridge.bind().stream() in agent.ts does not use tracking! ` +
              `It calls createLanggraphStreamResponse directly, which bypasses billing.`
          );
        }
      }
    });
  });
});
