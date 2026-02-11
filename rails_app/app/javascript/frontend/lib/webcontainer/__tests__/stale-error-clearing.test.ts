import { describe, it, expect } from "vitest";
import { processViteChunk, isSuccessfulRebuild } from "../errorParsing";

describe("isSuccessfulRebuild — detects Vite rebuild success signals", () => {
  it("detects HMR update", () => {
    expect(isSuccessfulRebuild("[vite] hmr update /src/App.tsx")).toBe(true);
  });

  it("detects page reload", () => {
    expect(isSuccessfulRebuild("[vite] page reload src/pages/IndexPage.tsx")).toBe(true);
  });

  it("detects HMR update with timestamp prefix", () => {
    expect(isSuccessfulRebuild("4:30:15 PM [vite] hmr update /src/App.tsx")).toBe(true);
  });

  it("handles ANSI-colored output", () => {
    expect(isSuccessfulRebuild("\x1b[32m[vite]\x1b[0m hmr update /src/App.tsx")).toBe(true);
  });

  it("returns false for error output", () => {
    expect(isSuccessfulRebuild(`✘ [ERROR] No matching export in "src/App.tsx"`)).toBe(false);
  });

  it("returns false for normal Vite ready output", () => {
    expect(isSuccessfulRebuild("VITE v5.0.0  ready in 200 ms")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isSuccessfulRebuild("")).toBe(false);
  });
});

describe("processViteChunk — parse errors AND detect rebuild in one pass", () => {
  it("returns errors and no clear signal for an error chunk", () => {
    const result = processViteChunk(
      `[vite] Internal server error: No matching export in "src/components/Problem.tsx" for import "Problem"`
    );
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toBe("src/components/Problem.tsx");
    expect(result.clearsErrors).toBe(false);
  });

  it("returns no errors and a clear signal for HMR update", () => {
    const result = processViteChunk("[vite] hmr update /src/pages/IndexPage.tsx");
    expect(result.errors).toHaveLength(0);
    expect(result.clearsErrors).toBe(true);
  });

  it("returns no errors and a clear signal for page reload", () => {
    const result = processViteChunk("[vite] page reload src/pages/IndexPage.tsx");
    expect(result.errors).toHaveLength(0);
    expect(result.clearsErrors).toBe(true);
  });

  it("returns no errors and no clear signal for normal output", () => {
    const result = processViteChunk("VITE v5.0.0  ready in 200 ms");
    expect(result.errors).toHaveLength(0);
    expect(result.clearsErrors).toBe(false);
  });

  it("returns errors and no clear signal when chunk has both errors and rebuild", () => {
    // Edge case: a chunk that somehow contains both an error and a rebuild signal.
    // Errors take priority — don't clear if there are new errors in the same chunk.
    const chunk = [
      `✘ [ERROR] Could not resolve "bad-package"`,
      `[vite] hmr update /src/App.tsx`,
    ].join("\n");
    const result = processViteChunk(chunk);
    expect(result.errors).toHaveLength(1);
    expect(result.clearsErrors).toBe(false);
  });
});

describe("realistic scenario: transient errors during incremental file write", () => {
  it("error from partial mount → HMR success = errors should be clearable", () => {
    // This is the exact bug scenario from the LangSmith trace:
    // 1. Agent writes files incrementally (subagent writes Hero.tsx)
    // 2. IndexPage.tsx imports Problem, Features, CTA — they don't exist yet
    // 3. Vite tries to compile → import resolution error
    // 4. Remaining files get written
    // 5. Vite recompiles → HMR success
    // 6. But errors stayed in state → false positive error overlay

    // Step 1: Vite error from partial file mount
    const errorResult = processViteChunk(
      `[vite] Internal server error: No matching export in "src/components/Problem.tsx" for import "Problem"`
    );
    expect(errorResult.errors).toHaveLength(1);
    expect(errorResult.clearsErrors).toBe(false);

    // Step 2: Vite successfully rebuilds after all files are present
    const rebuildResult = processViteChunk(
      "4:30:15 PM [vite] hmr update /src/pages/IndexPage.tsx"
    );
    expect(rebuildResult.errors).toHaveLength(0);
    expect(rebuildResult.clearsErrors).toBe(true);
    // ^ Key assertion: the manager should clear accumulated errors here
  });

  it("multi-error chunk from esbuild → page reload = all errors clearable", () => {
    // Realistic multi-error chunk: Vite/esbuild reports multiple missing imports
    // when files are written one-by-one during agent streaming
    const errorChunk = [
      `Error:   Failed to scan for dependencies from entries:`,
      `  /home/project/index.html`,
      ``,
      `  ✘ [ERROR] No matching export in "src/components/Problem.tsx" for import "Problem"`,
      ``,
      `    src/pages/IndexPage.tsx:2:9:`,
      `      2 │ import { Problem } from "@/components/Problem";`,
      `        ╵          ~~~~~~~`,
      ``,
      `  ✘ [ERROR] No matching export in "src/components/Features.tsx" for import "Features"`,
      ``,
      `    src/pages/IndexPage.tsx:3:9:`,
      `      3 │ import { Features } from "@/components/Features";`,
      `        ╵          ~~~~~~~~`,
    ].join("\n");

    const errorResult = processViteChunk(errorChunk);
    expect(errorResult.errors).toHaveLength(2);
    expect(errorResult.clearsErrors).toBe(false);

    // All files now written → Vite rebuilds successfully
    const rebuildResult = processViteChunk("[vite] page reload src/pages/IndexPage.tsx");
    expect(rebuildResult.errors).toHaveLength(0);
    expect(rebuildResult.clearsErrors).toBe(true);
  });

  it("genuine persistent error does NOT get cleared by unrelated output", () => {
    // A real syntax error should persist — only HMR/reload clears errors
    const errorResult = processViteChunk("SyntaxError: Unexpected token (6:12)");
    expect(errorResult.errors).toHaveLength(1);
    expect(errorResult.clearsErrors).toBe(false);

    // Normal Vite output (not HMR/reload) should NOT signal a clear
    const normalResult = processViteChunk("  ➜  Local:   http://localhost:5173/");
    expect(normalResult.errors).toHaveLength(0);
    expect(normalResult.clearsErrors).toBe(false);
  });
});
