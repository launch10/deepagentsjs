// This file is automatically loaded by Vitest before running tests
// Import all custom matchers
import "./matchers";
import "./graph";
import { beforeAll, afterAll } from "vitest";
import { cleanupPool, NodeCache } from "@core";
import { setPollyNamespace, clearPollyNamespace, stopPolly } from "@utils";
import path from "path";

// Disable NodeCache for all tests
beforeAll((suite: any) => {
  NodeCache.disable();

  // Auto-derive Polly recording namespace from the test file path.
  // This isolates recordings per test file so they don't bloat into
  // single 137MB HAR files shared across all tests.
  const filepath: string | undefined = suite?.filepath ?? suite?.file?.filepath;
  if (filepath) {
    const testsDir = path.join(process.cwd(), "tests", "tests");
    const relative = path.relative(testsDir, filepath);
    // Strip .test.ts / .eval.test.ts / .spec.ts extensions
    const namespace = relative.replace(/\.(?:eval\.)?(?:test|spec)\.[jt]sx?$/, "");
    if (namespace && !namespace.startsWith("..")) {
      setPollyNamespace(namespace);
    }
  }
});

// Clean up Polly and database connections after all tests
afterAll(async () => {
  await stopPolly();
  clearPollyNamespace();
  await cleanupPool();
});
