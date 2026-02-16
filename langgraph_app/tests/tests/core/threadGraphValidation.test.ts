import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * THREAD-GRAPH VALIDATION AUDIT - DATA INTEGRITY CRITICAL
 *
 * Statically analyzes route handlers to ensure thread-graph ownership
 * validation is properly configured. Prevents cross-graph thread
 * contamination (e.g. deploy using a website thread and overwriting its checkpoint).
 *
 * ARCHITECTURE:
 * - Every route that handles threadId MUST validate graph ownership
 * - validateThreadGraphOrError checks both account ownership AND chat_type match
 * - New threads (chat doesn't exist yet) are allowed — chat created during graph execution
 * - Existing threads with mismatched chat_type are rejected with 409 Conflict
 */

describe.sequential("Thread-Graph Validation Audit - DATA INTEGRITY CRITICAL", () => {
  const routesDir = path.join(process.cwd(), "app/server/routes");

  // Every route that handles threadId MUST validate graph ownership
  const GRAPH_ROUTES = [
    { file: "brainstorm.ts", expectedChatType: "brainstorm" },
    { file: "website.ts", expectedChatType: "website" },
    { file: "deploy.ts", expectedChatType: "deploy" },
    { file: "ads.ts", expectedChatType: "ads" },
    { file: "insights.ts", expectedChatType: "insights" },
    { file: "support.ts", expectedChatType: "support" },
  ];

  describe("Routes MUST use validateThreadGraphOrError", () => {
    for (const { file, expectedChatType } of GRAPH_ROUTES) {
      it(`${file} MUST call validateThreadGraphOrError with "${expectedChatType}"`, () => {
        const filePath = path.join(routesDir, file);
        if (!fs.existsSync(filePath)) return;

        const content = fs.readFileSync(filePath, "utf-8");

        // Must import the validation function
        expect(content).toContain("validateThreadGraphOrError");

        // Must pass the correct chat_type
        expect(content).toContain(`"${expectedChatType}"`);
      });
    }
  });

  describe("No route uses old validateThreadOrError", () => {
    it("ALL routes must use graph-aware validation, not ownership-only", () => {
      const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts"));
      const violations: string[] = [];

      for (const file of routeFiles) {
        const content = fs.readFileSync(path.join(routesDir, file), "utf-8");
        // Skip if file doesn't deal with threads
        if (!content.includes("threadId")) continue;

        if (
          content.includes("validateThreadOrError") &&
          !content.includes("validateThreadGraphOrError")
        ) {
          violations.push(file);
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `DATA INTEGRITY CRITICAL: Routes using ownership-only validation!\n\n` +
            `  ${violations.join(", ")}\n\n` +
            `These routes accept ANY thread regardless of graph type.\n` +
            `FIX: Use validateThreadGraphOrError(c, threadId, auth, "expected_chat_type")`
        );
      }
    });
  });

  describe("Comprehensive route scan", () => {
    it("ALL route POST handlers with threadId MUST validate graph type", () => {
      const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts"));
      const violations: string[] = [];

      for (const file of routeFiles) {
        const content = fs.readFileSync(path.join(routesDir, file), "utf-8");

        // Check for POST handlers that use threadId
        const hasPost = content.includes(".post(");
        const hasThreadId = content.includes("threadId");
        if (!hasPost || !hasThreadId) continue;

        if (!content.includes("validateThreadGraphOrError")) {
          violations.push(file);
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `DATA INTEGRITY CRITICAL: POST routes without graph validation!\n\n` +
            `  ${violations.join(", ")}\n\n` +
            `A thread from one graph could overwrite another graph's checkpoint.\n` +
            `FIX: Add validateThreadGraphOrError() before graph invocation.`
        );
      }
    });
  });
});
