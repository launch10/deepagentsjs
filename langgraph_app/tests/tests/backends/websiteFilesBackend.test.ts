import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebsiteFilesBackend, DatabaseSnapshotter } from "@services";
import { websiteFiles, websites, eq, and, db, Types as DBTypes } from "@db";
import * as fs from "fs/promises";
import * as path from "path";
import type { FileInfo, GrepMatch } from "deepagents";

describe("WebsiteFilesBackend", () => {
  let backend: WebsiteFilesBackend;
  let websiteId: number;

  beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");

    const [website] = await db.select().from(websites).limit(1);

    if (!website || !website.name || website.name === null) {
      throw new Error("No website found in snapshot");
    }
    websiteId = website.id;

    backend = await WebsiteFilesBackend.create({
      website: website as DBTypes.WebsiteType,
      jwt: "test-jwt",
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
      const packageJson = await fs.readFile(path.join(rootDir, "package.json"), "utf-8");
      expect(packageJson).toContain("name");
    });
  });

  describe("lsInfo", () => {
    it("lists files in root directory", async () => {
      const files = await backend.lsInfo("/");
      expect(files.length).toBeGreaterThan(0);
      expect(
        files.some((f: FileInfo) => f.path.includes("src") || f.path.includes("package"))
      ).toBe(true);
    });

    it("lists files in a subdirectory", async () => {
      const files = await backend.lsInfo("/src");
      const paths = files.map((f: FileInfo) => f.path);
      expect(paths.some((p: string) => p.includes("src/App.tsx"))).toBe(true);
      expect(paths.some((p: string) => p.includes("src/components"))).toBe(true);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe("read", () => {
    it("reads a file without line numbers (raw content)", async () => {
      const content = await backend.read("/package.json");
      // Content should NOT have line number prefixes (e.g., "1\t")
      // This was changed to return raw content for better agent compatibility
      expect(content).not.toMatch(/^\d+\t/m);
      expect(content).toContain('"name"');
    });

    it("returns error string for non-existent file", async () => {
      // read() catches errors and returns an error string (matches deepagents behavior)
      const result = await backend.read("/nonexistent.ts");
      expect(result).toContain("Error:");
      expect(result).toContain("ENOENT");
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
      expect(files.every((f: FileInfo) => f.path.endsWith(".tsx"))).toBe(true);
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
        expect(results.every((r: GrepMatch) => r.path.startsWith("/src"))).toBe(true);
      }
    });

    it("filters by glob pattern for file extension", async () => {
      const results = await backend.grepRaw("import", "/", "**/*.tsx");
      expect(typeof results).not.toBe("string");
      if (typeof results === "string") return;

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r: GrepMatch) => r.path.endsWith(".tsx"))).toBe(true);
    });

    it("filters by glob pattern for specific directory", async () => {
      const results = await backend.grepRaw("import", "/", "**/components/**");
      expect(typeof results).not.toBe("string");
      if (typeof results === "string") return;

      if (results.length > 0) {
        expect(results.every((r: GrepMatch) => r.path.includes("/components/"))).toBe(true);
      }
    });

    it("combines path prefix and glob filtering", async () => {
      const results = await backend.grepRaw("import", "/src", "**/*.tsx");
      expect(typeof results).not.toBe("string");
      if (typeof results === "string") return;

      if (results.length > 0) {
        expect(
          results.every((r: GrepMatch) => r.path.startsWith("/src") && r.path.endsWith(".tsx"))
        ).toBe(true);
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
    it("writes to filesystem and persists to database after flush", async () => {
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

      // Flush deferred writes to DB
      await backend.flush();

      const dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(
          and(eq(websiteFiles.websiteId, websiteId), eq(websiteFiles.path, "src/test-file.ts"))
        );

      expect(dbFiles.length).toBe(1);
      expect(dbFiles[0]?.content).toBe(testContent);
      expect(dbFiles[0]?.shasum).toBeDefined();
    });

    it("updates existing file via edit and persists after flush", async () => {
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

      // Flush deferred writes to DB
      await backend.flush();

      const dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(
          and(eq(websiteFiles.websiteId, websiteId), eq(websiteFiles.path, "src/update-test.ts"))
        );

      expect(dbFiles.length).toBe(1);
      expect(dbFiles[0]?.content).toBe("const x = 1; const y = 3;");
    });
  });

  describe("edit", () => {
    it("edits file in filesystem and persists to database after flush", async () => {
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

      // Flush deferred writes to DB
      await backend.flush();

      const dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(
          and(eq(websiteFiles.websiteId, websiteId), eq(websiteFiles.path, "src/edit-test.ts"))
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

  describe("dirty tracking", () => {
    it("hasDirtyFiles() is false after hydrate", () => {
      expect(backend.hasDirtyFiles()).toBe(false);
      expect(backend.getDirtyPaths()).toEqual([]);
    });

    it("write() marks file as dirty", async () => {
      await backend.write("/src/dirty-test.ts", "const x = 1;");
      expect(backend.hasDirtyFiles()).toBe(true);
      expect(backend.getDirtyPaths()).toContain("/src/dirty-test.ts");
    });

    it("edit() marks file as dirty", async () => {
      // Write a file first, then edit it
      await backend.write("/src/dirty-edit.ts", "const x = 1;");
      // Clear dirty state via flush
      await backend.flush();
      expect(backend.hasDirtyFiles()).toBe(false);

      await backend.edit("/src/dirty-edit.ts", "const x = 1", "const x = 2");
      expect(backend.hasDirtyFiles()).toBe(true);
      expect(backend.getDirtyPaths()).toContain("/src/dirty-edit.ts");
    });

    it("tracks multiple dirty files", async () => {
      await backend.write("/src/a.ts", "a");
      await backend.write("/src/b.ts", "b");
      await backend.edit("/package.json", '"name"', '"projectName"');

      const dirty = backend.getDirtyPaths();
      expect(dirty).toHaveLength(3);
      expect(dirty).toContain("/src/a.ts");
      expect(dirty).toContain("/src/b.ts");
      expect(dirty).toContain("/package.json");
    });
  });

  describe("deferred writes", () => {
    it("write() updates FS but does NOT persist to DB", async () => {
      const testPath = "/src/deferred-write.ts";
      const testContent = 'export const deferred = "yes";';

      await backend.write(testPath, testContent);

      // FS should have the content
      const fsContent = await backend.read(testPath);
      expect(fsContent).toBe(testContent);

      // DB should NOT have it yet
      const dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(
          and(eq(websiteFiles.websiteId, websiteId), eq(websiteFiles.path, "src/deferred-write.ts"))
        );
      expect(dbFiles.length).toBe(0);
    });

    it("edit() updates FS but does NOT persist to DB", async () => {
      // Use a file that exists from the snapshot (already in DB)
      const files = await backend.globInfo("**/App.tsx");
      expect(files.length).toBeGreaterThan(0);
      const filePath = files[0]!.path;

      const originalContent = await backend.read(filePath);
      expect(originalContent).toBeTruthy();

      // Pick a small unique string to replace
      const oldStr = "export default";
      expect(originalContent).toContain(oldStr);

      await backend.edit(filePath, oldStr, "export default /* edited */");

      // FS should have the edit
      const fsContent = await backend.read(filePath);
      expect(fsContent).toContain("/* edited */");

      // DB should still have original content (edit not persisted)
      const normalizedPath = filePath.replace(/^\//, "");
      const dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(and(eq(websiteFiles.websiteId, websiteId), eq(websiteFiles.path, normalizedPath)));

      // The file may be a template file (not in websiteFiles yet), so check accordingly
      if (dbFiles.length > 0) {
        expect(dbFiles[0]?.content).not.toContain("/* edited */");
      }
    });
  });

  describe("flush", () => {
    it("flush() persists all dirty files to DB", async () => {
      const testPath = "/src/flush-test.ts";
      const testContent = 'export const flushed = "yes";';

      await backend.write(testPath, testContent);

      // Before flush: not in DB
      let dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(
          and(eq(websiteFiles.websiteId, websiteId), eq(websiteFiles.path, "src/flush-test.ts"))
        );
      expect(dbFiles.length).toBe(0);

      // Flush
      await backend.flush();

      // After flush: in DB
      dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(
          and(eq(websiteFiles.websiteId, websiteId), eq(websiteFiles.path, "src/flush-test.ts"))
        );
      expect(dbFiles.length).toBe(1);
      expect(dbFiles[0]?.content).toBe(testContent);
    });

    it("flush() batches multiple files in one call", async () => {
      await backend.write("/src/batch-a.ts", "const a = 1;");
      await backend.write("/src/batch-b.ts", "const b = 2;");
      await backend.write("/src/batch-c.ts", "const c = 3;");

      await backend.flush();

      const dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      const paths = dbFiles.map((f) => f.path);
      expect(paths).toContain("src/batch-a.ts");
      expect(paths).toContain("src/batch-b.ts");
      expect(paths).toContain("src/batch-c.ts");
    });

    it("flush() is idempotent — second call is no-op", async () => {
      await backend.write("/src/idempotent.ts", "const x = 1;");

      await backend.flush();
      expect(backend.hasDirtyFiles()).toBe(false);

      // Second flush should do nothing
      await backend.flush();
      expect(backend.hasDirtyFiles()).toBe(false);

      // DB should still have exactly one file
      const dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(
          and(eq(websiteFiles.websiteId, websiteId), eq(websiteFiles.path, "src/idempotent.ts"))
        );
      expect(dbFiles.length).toBe(1);
    });

    it("flush() sends final content after multiple edits to same file", async () => {
      const testPath = "/src/multi-edit.ts";
      await backend.write(testPath, "aaa bbb ccc");
      await backend.edit(testPath, "aaa", "xxx");
      await backend.edit(testPath, "bbb", "yyy");

      await backend.flush();

      const dbFiles = await db
        .select()
        .from(websiteFiles)
        .where(
          and(eq(websiteFiles.websiteId, websiteId), eq(websiteFiles.path, "src/multi-edit.ts"))
        );
      expect(dbFiles.length).toBe(1);
      expect(dbFiles[0]?.content).toBe("xxx yyy ccc");
    });

    it("flush() clears dirty state", async () => {
      await backend.write("/src/clear-dirty.ts", "test");
      expect(backend.hasDirtyFiles()).toBe(true);

      await backend.flush();
      expect(backend.hasDirtyFiles()).toBe(false);
      expect(backend.getDirtyPaths()).toEqual([]);
    });

    it("flush() with no dirty files is a no-op", async () => {
      expect(backend.hasDirtyFiles()).toBe(false);
      // Should not throw
      await backend.flush();
    });
  });

  describe("reads see deferred writes", () => {
    it("read() returns content from deferred write", async () => {
      await backend.write("/src/read-deferred.ts", "deferred content");
      const content = await backend.read("/src/read-deferred.ts");
      expect(content).toBe("deferred content");
    });

    it("read() returns content after deferred edit", async () => {
      await backend.write("/src/read-edit.ts", "before edit");
      await backend.edit("/src/read-edit.ts", "before", "after");
      const content = await backend.read("/src/read-edit.ts");
      expect(content).toBe("after edit");
    });

    it("globInfo() sees new deferred files", async () => {
      await backend.write("/src/new-glob-file.tsx", "export default () => <div/>;");
      const files = await backend.globInfo("**/new-glob-file.tsx");
      expect(files.length).toBe(1);
    });
  });

  describe("filesUpdate for state sync", () => {
    it("write() returns filesUpdate with file content as lines array", async () => {
      const testPath = "/src/state-sync-write.ts";
      const stateKey = "src/state-sync-write.ts"; // normalizePathForState strips leading /
      const testContent = 'export const value = "synced";';

      const result = await backend.write(testPath, testContent);

      expect(result.error).toBeUndefined();
      expect(result.filesUpdate).toBeDefined();
      expect(result.filesUpdate).not.toBeNull();

      const fileData = result.filesUpdate?.[stateKey];
      expect(fileData).toBeDefined();
      // FileData format: content is an array of lines
      expect(Array.isArray(fileData?.content)).toBe(true);
      expect(fileData?.content.join("\n")).toBe(testContent);
      expect(fileData?.created_at).toBeDefined();
      expect(fileData?.modified_at).toBeDefined();
    });

    it("edit() returns filesUpdate with updated content", async () => {
      const testPath = "/src/state-sync-edit.ts";
      const stateKey = "src/state-sync-edit.ts";
      const initialContent = 'const msg = "before";';
      const expectedContent = 'const msg = "after";';

      await backend.write(testPath, initialContent);
      const result = await backend.edit(testPath, "before", "after");

      expect(result.error).toBeUndefined();
      expect(result.filesUpdate).toBeDefined();
      expect(result.filesUpdate).not.toBeNull();

      const fileData = result.filesUpdate?.[stateKey];
      expect(fileData).toBeDefined();
      expect(fileData?.content.join("\n")).toBe(expectedContent);
      expect(fileData?.modified_at).toBeDefined();
    });

    it("edit() with replaceAll returns filesUpdate with all replacements", async () => {
      const testPath = "/src/state-sync-replace-all.ts";
      const stateKey = "src/state-sync-replace-all.ts";
      const initialContent = "foo bar foo baz foo";
      const expectedContent = "qux bar qux baz qux";

      await backend.write(testPath, initialContent);
      const result = await backend.edit(testPath, "foo", "qux", true);

      expect(result.error).toBeUndefined();
      expect(result.occurrences).toBe(3);
      expect(result.filesUpdate).toBeDefined();

      const fileData = result.filesUpdate?.[stateKey];
      expect(fileData?.content.join("\n")).toBe(expectedContent);
    });

    it("write() filesUpdate format matches deepagents FileData interface", async () => {
      const testPath = "/src/middleware-compat.ts";
      const stateKey = "src/middleware-compat.ts";
      const testContent = "export default {}";

      const result = await backend.write(testPath, testContent);

      // Middleware expects Record<string, FileData> where FileData has:
      // { content: string[], created_at: string, modified_at: string }
      expect(typeof result.filesUpdate).toBe("object");
      expect(result.filesUpdate).not.toBeNull();

      const fileData = result.filesUpdate?.[stateKey];
      expect(fileData).toBeDefined();
      expect(Array.isArray(fileData?.content)).toBe(true);
      expect(typeof fileData?.created_at).toBe("string");
      expect(typeof fileData?.modified_at).toBe("string");
    });
  });
});

/**
 * Concurrent edit safety tests — FS-only, no DB or Rails server needed.
 *
 * These reproduce the real-world race condition where LangGraph's ToolNode
 * (tool_node.js:185) fires all tool calls from a single LLM response via
 * Promise.all. When the LLM batches multiple edit_file calls for the same
 * file in one response, the underlying read-modify-write cycle in
 * FilesystemBackend.edit() races: all readers see the original content,
 * each applies only its own replacement, and the last writer wins.
 */
describe("WebsiteFilesBackend concurrent edit safety", () => {
  let backend: WebsiteFilesBackend;

  beforeEach(() => {
    // Construct directly — no DB hydration needed for FS-only tests
    backend = new WebsiteFilesBackend({
      website: { id: 999, name: "concurrent_test", accountId: 1 } as any,
      jwt: "test-jwt",
    });
  });

  afterEach(async () => {
    await backend.cleanup();
  });

  it("preserves all edits when multiple edit() calls run concurrently on the same file", async () => {
    const testPath = "/src/concurrent-edit.ts";
    const initialContent = [
      "const a = 1;",
      "const b = 2;",
      "const c = 3;",
      "const d = 4;",
    ].join("\n");

    await backend.write(testPath, initialContent);

    // Fire 4 concurrent edits to the same file — simulates Promise.all
    // in LangGraph's ToolNode which processes all tool calls in parallel
    const results = await Promise.all([
      backend.edit(testPath, "const a = 1;", "const a = 10;"),
      backend.edit(testPath, "const b = 2;", "const b = 20;"),
      backend.edit(testPath, "const c = 3;", "const c = 30;"),
      backend.edit(testPath, "const d = 4;", "const d = 40;"),
    ]);

    // All edits should succeed (no errors)
    for (const result of results) {
      expect(result.error).toBeUndefined();
    }

    // Final content must have ALL four edits applied — not just the last writer's
    const finalContent = await backend.read(testPath);
    expect(finalContent).toBe(
      ["const a = 10;", "const b = 20;", "const c = 30;", "const d = 40;"].join("\n")
    );
  });
});
