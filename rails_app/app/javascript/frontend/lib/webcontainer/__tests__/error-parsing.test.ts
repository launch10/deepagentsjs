import { describe, it, expect } from "vitest";
import { parseBuildErrors, parsePreviewMessage } from "../errorParsing";
import { PreviewMessageType } from "@webcontainer/api";

describe("parseBuildErrors — parses stderr lines into ConsoleError[]", () => {
  describe("export mismatch errors", () => {
    it("parses Vite export mismatch error", () => {
      const line = `[vite] Internal server error: No matching export in "src/components/Problem.tsx" for import "Problem"`;
      const errors = parseBuildErrors(line);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: "error",
        message: expect.stringContaining("No matching export"),
        file: "src/components/Problem.tsx",
      });
    });

    it("parses export mismatch with nested path", () => {
      const line = `[vite] Internal server error: No matching export in "src/pages/home/HeroSection.tsx" for import "HeroSection"`;
      const errors = parseBuildErrors(line);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: "error",
        file: "src/pages/home/HeroSection.tsx",
      });
    });
  });

  describe("syntax errors", () => {
    it("parses SyntaxError from Vite", () => {
      const line = `SyntaxError: Unexpected token (6:12)`;
      const errors = parseBuildErrors(line);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: "error",
        message: expect.stringContaining("SyntaxError"),
      });
    });

    it("parses esbuild syntax error with file and code frame", () => {
      const line = [
        `✘ [ERROR] Expected "," but found "className"`,
        ``,
        `    src/components/Header.tsx:15:8:`,
        `      15 │ <div className="header">`,
        `         ╵         ^`,
      ].join("\n");
      const errors = parseBuildErrors(line);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: "error",
        message: expect.stringContaining("Expected"),
        file: "src/components/Header.tsx",
      });
      expect(errors[0].frame).toBeDefined();
    });
  });

  describe("dependency errors", () => {
    it("parses failed dependency scan (standalone)", () => {
      const line = `Failed to scan for dependencies from entries`;
      const errors = parseBuildErrors(line);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: "error",
        message: expect.stringContaining("Failed to scan for dependencies"),
      });
    });

    it("parses module resolution failure", () => {
      const line = `[vite] Internal server error: Failed to resolve import "react-icons/fa" from "src/components/Footer.tsx". Does the file exist?`;
      const errors = parseBuildErrors(line);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: "error",
        message: expect.stringContaining("Failed to resolve import"),
        file: "src/components/Footer.tsx",
      });
    });
  });

  describe("general build errors", () => {
    it("parses esbuild ERROR lines", () => {
      const line = `✘ [ERROR] Could not resolve "nonexistent-package"`;
      const errors = parseBuildErrors(line);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: "error",
        message: expect.stringContaining("Could not resolve"),
      });
    });

    it("parses Pre-transform error", () => {
      const line = `10:30:00 AM [vite] Pre-transform error: Could not load entry module "src/main.tsx"`;
      const errors = parseBuildErrors(line);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: "error",
        message: expect.stringContaining("Could not load entry module"),
      });
    });
  });

  describe("multi-error chunks", () => {
    it("extracts all esbuild errors from a single chunk", () => {
      // This is what a real WebContainer chunk looks like — multiple errors in one blob
      const chunk = [
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
        ``,
        `  ✘ [ERROR] No matching export in "src/components/CTA.tsx" for import "CTA"`,
        ``,
        `    src/pages/IndexPage.tsx:5:9:`,
        `      5 │ import { CTA } from "@/components/CTA";`,
        `        ╵          ~~~`,
      ].join("\n");

      const errors = parseBuildErrors(chunk);

      expect(errors).toHaveLength(3);
      expect(errors[0]).toMatchObject({
        type: "error",
        message: expect.stringContaining("No matching export"),
        file: "src/components/Problem.tsx",
      });
      expect(errors[1].file).toBe("src/components/Features.tsx");
      expect(errors[2].file).toBe("src/components/CTA.tsx");
    });

    it("prefers esbuild blocks over dependency scan wrapper", () => {
      const chunk = [
        `Failed to scan for dependencies from entries:`,
        `  ✘ [ERROR] Could not resolve "bad-package"`,
      ].join("\n");

      const errors = parseBuildErrors(chunk);
      // Should return the specific esbuild error, not the generic "Failed to scan" wrapper
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("Could not resolve");
    });
  });

  describe("ANSI escape code handling", () => {
    it("strips ANSI codes before matching", () => {
      // Simulating ANSI-colored output from esbuild
      const line = `\x1b[31m✘\x1b[0m \x1b[31m[ERROR]\x1b[0m No matching export in "src/App.tsx" for import "App"`;
      const errors = parseBuildErrors(line);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("No matching export");
    });

    it("ignores pure ANSI control sequences (cursor movement)", () => {
      expect(parseBuildErrors("\x1b[1;1H")).toEqual([]);
      expect(parseBuildErrors("\x1b[0J")).toEqual([]);
      expect(parseBuildErrors("\x1b[1G\x1b[0K")).toEqual([]);
    });
  });

  describe("non-error lines", () => {
    it("returns empty for normal Vite ready output", () => {
      expect(parseBuildErrors("VITE v5.0.0  ready in 200 ms")).toEqual([]);
    });

    it("returns empty for local URL line", () => {
      expect(parseBuildErrors("  ➜  Local:   http://localhost:5173/")).toEqual([]);
    });

    it("returns empty for HMR update lines", () => {
      expect(parseBuildErrors("[vite] hmr update /src/App.tsx")).toEqual([]);
    });

    it("returns empty for empty string", () => {
      expect(parseBuildErrors("")).toEqual([]);
    });

    it("returns empty for node deprecation warnings (noise)", () => {
      expect(
        parseBuildErrors("(node:1234) ExperimentalWarning: Type Stripping")
      ).toEqual([]);
      expect(
        parseBuildErrors("(node:5678) DeprecationWarning: something")
      ).toEqual([]);
    });

    it("filters out esbuild 'The build was canceled' (transient during rapid file writes)", () => {
      expect(parseBuildErrors(`✘ [ERROR] The build was canceled`)).toEqual([]);
    });

    it("keeps real errors in a chunk that also contains 'The build was canceled'", () => {
      const chunk = [
        `✘ [ERROR] The build was canceled`,
        ``,
        `✘ [ERROR] No matching export in "src/components/Hero.tsx" for import "Hero"`,
        ``,
        `    src/pages/IndexPage.tsx:2:9:`,
        `      2 │ import { Hero } from "@/components/Hero";`,
        `        ╵          ~~~~`,
      ].join("\n");
      const errors = parseBuildErrors(chunk);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("No matching export");
      expect(errors[0].file).toBe("src/components/Hero.tsx");
    });
  });

  describe("warning detection", () => {
    it("parses Vite warnings as type warning", () => {
      const line = `[vite] warning: "import" is not a valid export name`;
      const errors = parseBuildErrors(line);

      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe("warning");
    });
  });

  describe("timestamp", () => {
    it("includes a Date timestamp on every parsed error", () => {
      const errors = parseBuildErrors(`SyntaxError: Unexpected token`);
      expect(errors).toHaveLength(1);
      expect(errors[0].timestamp).toBeInstanceOf(Date);
    });
  });
});

describe("parsePreviewMessage — maps WebContainer PreviewMessage to ConsoleError", () => {
  it("maps UncaughtException to ConsoleError with type error", () => {
    const msg = {
      type: PreviewMessageType.UncaughtException as const,
      message: "ReferenceError: foo is not defined",
      stack: "at App.tsx:5:3",
      previewId: "p1",
      port: 5173,
      pathname: "/",
      search: "",
      hash: "",
    };
    const error = parsePreviewMessage(msg);

    expect(error).toMatchObject({
      type: "error",
      message: "ReferenceError: foo is not defined",
      stack: "at App.tsx:5:3",
    });
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it("maps UnhandledRejection to ConsoleError with type error", () => {
    const msg = {
      type: PreviewMessageType.UnhandledRejection as const,
      message: "Promise rejected: network error",
      stack: undefined,
      previewId: "p1",
      port: 5173,
      pathname: "/",
      search: "",
      hash: "",
    };
    const error = parsePreviewMessage(msg);

    expect(error).toMatchObject({
      type: "error",
      message: "Promise rejected: network error",
      stack: undefined,
    });
  });

  it("maps ConsoleError to ConsoleError with type error", () => {
    const msg = {
      type: PreviewMessageType.ConsoleError as const,
      args: ["Failed to load", { url: "/api/data" }],
      stack: "at fetch (app.js:10)",
      previewId: "p1",
      port: 5173,
      pathname: "/",
      search: "",
      hash: "",
    };
    const error = parsePreviewMessage(msg);

    expect(error).toMatchObject({
      type: "error",
      message: expect.stringContaining("Failed to load"),
      stack: "at fetch (app.js:10)",
    });
  });
});
