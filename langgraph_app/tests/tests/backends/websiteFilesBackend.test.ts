import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebsiteFilesBackend, DatabaseSnapshotter } from "@services";
import { Website } from "@types";
import { websiteFiles, websites, eq, and, db } from "@db";
import * as fs from "fs/promises";
import * as path from "path";
import { uniq } from "@utils";

describe("WebsiteFilesBackend", () => {
  let backend: WebsiteFilesBackend;
  let websiteId: number;

  beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("website_finished");

    const [website] = await db
      .select()
      .from(websites)
      .limit(1);

    if (!website || !website.name || website.name === null) {
      throw new Error("No website found in snapshot");
    }
    websiteId = website.id;

    backend = await WebsiteFilesBackend.create({ 
      website: website as Website.WebsiteType,
      jwt: "test-jwt"
    });
  }, 30000);

  afterEach(async () => {
    if (backend) {
      await backend.cleanup();
    }
  });

  describe("create and hydrate", () => {
    it("creates a backend with files hydrated from database", async () => {
      const files = await backend.lsInfo("/");
      expect(files.length).toBeGreaterThan(0);
    });

    it("hydrates files to filesystem from code_files view", async () => {
      const rootDir = backend.getRootDir();
      const packageJson = await fs.readFile(
        path.join(rootDir, "package.json"),
        "utf-8"
      );
      expect(packageJson).toContain("name");
    });
  });

  describe("lsInfo", () => {
    it("lists files in root directory", async () => {
      const files = await backend.lsInfo("/");
      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.path.includes("src") || f.path.includes("package"))).toBe(true);
    });

    it("lists files in a subdirectory", async () => {
      const files = await backend.lsInfo("/src");
      const paths = files.map((f) => f.path);
      expect(paths.some((p) => p.includes("src/App.tsx"))).toBe(true);
      expect(paths.some((p) => p.includes("src/components"))).toBe(true);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe("read", () => {
    it("reads a file with line numbers", async () => {
      const content = await backend.read("/package.json");
      expect(content).toContain("1\t");
    });

    it("returns error for non-existent file", async () => {
      const content = await backend.read("/nonexistent.ts");
      expect(content).toContain("Error reading file");
      expect(content).toContain("ENOENT");
    });
  });

  describe("readRaw", () => {
    it("reads raw file data", async () => {
      const data = await backend.readRaw("/package.json");
      expect(data.content).toBeDefined();
      expect(Array.isArray(data.content)).toBe(true);
    });
  });

  describe("globInfo", () => {
    it("finds TypeScript files", async () => {
      const files = await backend.globInfo("**/*.tsx");
      expect(files.length).toBeGreaterThan(0);
      expect(files.every((f) => f.path.endsWith(".tsx"))).toBe(true);
    });

    it("finds files with specific pattern", async () => {
      const files = await backend.globInfo("**/index.*");
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe("grepRaw", () => {
    it("searches for pattern in files using Postgres FTS", async () => {
      const results = await backend.grepRaw("import");
      expect(typeof results).not.toBe("string");
      if (typeof results === "string") return;

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.path).toBeDefined();
      expect(results[0]?.line).toBeDefined();
      expect(results[0]?.text).toBeDefined();
    });

    it("filters by path prefix", async () => {
      const results = await backend.grepRaw("import", "/src");
      expect(typeof results).not.toBe("string");
      if (typeof results === "string") return;

      if (results.length > 0) {
        expect(results.every((r) => r.path.startsWith("/src"))).toBe(true);
      }
    });

    it("filters by glob pattern for file extension", async () => {
      const results = await backend.grepRaw("import", "/", "**/*.tsx");
      expect(typeof results).not.toBe("string");
      if (typeof results === "string") return;

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.path.endsWith(".tsx"))).toBe(true);
    });

    it("filters by glob pattern for specific directory", async () => {
      const results = await backend.grepRaw("import", "/", "**/components/**");
      expect(typeof results).not.toBe("string");
      if (typeof results === "string") return;

      if (results.length > 0) {
        expect(results.every((r) => r.path.includes("/components/"))).toBe(true);
      }
    });

    it("combines path prefix and glob filtering", async () => {
      const results = await backend.grepRaw("import", "/src", "**/*.tsx");
      expect(typeof results).not.toBe("string");
      if (typeof results === "string") return;

      if (results.length > 0) {
        expect(results.every((r) => r.path.startsWith("/src") && r.path.endsWith(".tsx"))).toBe(true);
      }
    });

    it("returns empty array when glob matches no files", async () => {
      const results = await backend.grepRaw("import", "/", "**/*.nonexistent");
      expect(typeof results).not.toBe("string");
      if (typeof results === "string") return;

      expect(results).toEqual([]);
    });

    it("returns error for invalid regex", async () => {
      const results = await backend.grepRaw("[invalid");
      expect(typeof results).toBe("string");
      expect(results).toContain("Invalid regex");
    });
  });

  describe("write", () => {
    it("writes to filesystem and database", async () => {
      const testPath = "/src/test-file.ts";
      const testContent = 'export const test = "hello";';

      const result = await backend.write(testPath, testContent);
      expect(result.error).toBeUndefined();
      expect(result.path).toBe(testPath);

      const fsContent = await fs.readFile(
        path.join(backend.getRootDir(), "src/test-file.ts"),
        "utf-8"
      );
      expect(fsContent).toBe(testContent);

      const dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(
          and(
            eq(websiteFiles.websiteId, websiteId),
            eq(websiteFiles.path, "src/test-file.ts")
          )
        );

      expect(dbFiles.length).toBe(1);
      expect(dbFiles[0]?.content).toBe(testContent);
      expect(dbFiles[0]?.shasum).toBeDefined();
    });

    it("updates existing file via edit syncs to database", async () => {
      const testPath = "/src/update-test.ts";
      const initialContent = "const x = 1; const y = 2;";

      await backend.write(testPath, initialContent);
      const result = await backend.edit(testPath, "const y = 2", "const y = 3");

      expect(result.error).toBeUndefined();
      expect(result.occurrences).toBe(1);

      const fsContent = await fs.readFile(
        path.join(backend.getRootDir(), "src/update-test.ts"),
        "utf-8"
      );
      expect(fsContent).toBe("const x = 1; const y = 3;");

      const dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(
          and(
            eq(websiteFiles.websiteId, websiteId),
            eq(websiteFiles.path, "src/update-test.ts")
          )
        );

      expect(dbFiles.length).toBe(1);
      expect(dbFiles[0]?.content).toBe("const x = 1; const y = 3;");
    });
  });

  describe("edit", () => {
    it("edits file in filesystem and syncs to database", async () => {
      const testPath = "/src/edit-test.ts";
      const initialContent = 'const greeting = "hello";';

      await backend.write(testPath, initialContent);

      const result = await backend.edit(testPath, "hello", "world");
      expect(result.error).toBeUndefined();
      expect(result.occurrences).toBe(1);

      const fsContent = await fs.readFile(
        path.join(backend.getRootDir(), "src/edit-test.ts"),
        "utf-8"
      );
      expect(fsContent).toBe('const greeting = "world";');

      const dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(
          and(
            eq(websiteFiles.websiteId, websiteId),
            eq(websiteFiles.path, "src/edit-test.ts")
          )
        );

      expect(dbFiles[0]?.content).toBe('const greeting = "world";');
    });

    it("replaces all occurrences when replaceAll is true", async () => {
      const testPath = "/src/replace-all-test.ts";
      const initialContent = "a b a c a";

      await backend.write(testPath, initialContent);

      const result = await backend.edit(testPath, "a", "x", true);
      expect(result.error).toBeUndefined();
      expect(result.occurrences).toBe(3);

      const fsContent = await fs.readFile(
        path.join(backend.getRootDir(), "src/replace-all-test.ts"),
        "utf-8"
      );
      expect(fsContent).toBe("x b x c x");
    });

    it("returns error when old string not found", async () => {
      const testPath = "/src/not-found-test.ts";
      const content = "const x = 1;";

      await backend.write(testPath, content);

      const result = await backend.edit(testPath, "notfound", "replacement");
      expect(result.error).toBeDefined();
    });
  });
});
