import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebsiteFilesBackend, DatabaseSnapshotter } from "@services";
import { websites, db, Types as DBTypes } from "@db";
import { executeTextEditorCommand } from "@tools";

describe("executeTextEditorCommand", () => {
  let backend: WebsiteFilesBackend;

  beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("website_step_finished");

    const [website] = await db.select().from(websites).limit(1);
    if (!website?.name) throw new Error("No website found in snapshot");

    backend = await WebsiteFilesBackend.create({
      website: website as DBTypes.WebsiteType,
      jwt: "test-jwt",
    });
  }, 30000);

  afterEach(async () => {
    if (backend) await backend.cleanup();
  });

  // ─── view command ───────────────────────────────────────────

  describe("view", () => {
    it("returns file contents with line numbers", async () => {
      const result = await executeTextEditorCommand(backend, {
        command: "view",
        path: "/package.json",
      });
      expect(result).toContain("1:");
      expect(result).toContain('"name"');
    });

    it("returns line range when view_range specified", async () => {
      const result = await executeTextEditorCommand(backend, {
        command: "view",
        path: "/package.json",
        view_range: [1, 3],
      });
      const lines = result.split("\n");
      expect(lines.length).toBe(3);
      expect(lines[0]).toMatch(/^1:/);
      expect(lines[2]).toMatch(/^3:/);
    });

    it("returns error for non-existent file", async () => {
      const result = await executeTextEditorCommand(backend, {
        command: "view",
        path: "/nonexistent.ts",
      });
      expect(result).toContain("Error");
    });
  });

  // ─── str_replace command ────────────────────────────────────

  describe("str_replace", () => {
    it("replaces exact match", async () => {
      await backend.write("/src/test.ts", 'const x = "hello";');

      const result = await executeTextEditorCommand(backend, {
        command: "str_replace",
        path: "/src/test.ts",
        old_str: '"hello"',
        new_str: '"world"',
      });

      expect(result).toContain("Successfully");

      const content = await backend.read("/src/test.ts");
      expect(content).toBe('const x = "world";');
    });

    it("returns error when old_str not found", async () => {
      await backend.write("/src/test.ts", 'const x = "hello";');

      const result = await executeTextEditorCommand(backend, {
        command: "str_replace",
        path: "/src/test.ts",
        old_str: "nonexistent string",
        new_str: "replacement",
      });

      expect(result).toContain("Error");
      expect(result).toContain("No match found");
    });

    it("returns error when old_str matches multiple locations", async () => {
      await backend.write("/src/test.ts", "const a = 1;\nconst b = 1;\nconst c = 1;");

      const result = await executeTextEditorCommand(backend, {
        command: "str_replace",
        path: "/src/test.ts",
        old_str: "= 1",
        new_str: "= 2",
      });

      expect(result).toContain("Error");
      expect(result).toMatch(/multiple|3/i);
    });

    it("handles multiline replacements", async () => {
      const content = `function hello() {\n  console.log("hi");\n  return true;\n}`;
      await backend.write("/src/test.ts", content);

      const result = await executeTextEditorCommand(backend, {
        command: "str_replace",
        path: "/src/test.ts",
        old_str: '  console.log("hi");\n  return true;',
        new_str: '  console.log("bye");\n  return false;',
      });

      expect(result).toContain("Successfully");

      const updated = await backend.read("/src/test.ts");
      expect(updated).toContain('"bye"');
      expect(updated).toContain("false");
    });

    it("returns error for non-existent file", async () => {
      const result = await executeTextEditorCommand(backend, {
        command: "str_replace",
        path: "/nonexistent.ts",
        old_str: "foo",
        new_str: "bar",
      });
      expect(result).toContain("Error");
    });
  });

  // ─── create command ─────────────────────────────────────────

  describe("create", () => {
    it("creates a new file", async () => {
      const result = await executeTextEditorCommand(backend, {
        command: "create",
        path: "/src/new-file.ts",
        file_text: "export const x = 42;",
      });

      expect(result).toContain("Created");

      const content = await backend.read("/src/new-file.ts");
      expect(content).toBe("export const x = 42;");
    });

    it("returns error when file already exists", async () => {
      await backend.write("/src/existing.ts", "content");

      const result = await executeTextEditorCommand(backend, {
        command: "create",
        path: "/src/existing.ts",
        file_text: "new content",
      });

      expect(result).toContain("Error");
      expect(result).toContain("exists");
    });
  });

  // ─── insert command ─────────────────────────────────────────

  describe("insert", () => {
    it("inserts text at beginning of file (line 0)", async () => {
      await backend.write("/src/test.ts", "line1\nline2\nline3");

      const result = await executeTextEditorCommand(backend, {
        command: "insert",
        path: "/src/test.ts",
        insert_line: 0,
        new_str: "inserted",
      });

      expect(result).toContain("Inserted");

      const content = await backend.read("/src/test.ts");
      expect(content).toBe("inserted\nline1\nline2\nline3");
    });

    it("inserts text after a specific line", async () => {
      await backend.write("/src/test.ts", "line1\nline2\nline3");

      const result = await executeTextEditorCommand(backend, {
        command: "insert",
        path: "/src/test.ts",
        insert_line: 2,
        new_str: "inserted",
      });

      expect(result).toContain("Inserted");

      const content = await backend.read("/src/test.ts");
      expect(content).toBe("line1\nline2\ninserted\nline3");
    });

    it("inserts text at end of file", async () => {
      await backend.write("/src/test.ts", "line1\nline2");

      const result = await executeTextEditorCommand(backend, {
        command: "insert",
        path: "/src/test.ts",
        insert_line: 2,
        new_str: "line3",
      });

      expect(result).toContain("Inserted");

      const content = await backend.read("/src/test.ts");
      expect(content).toBe("line1\nline2\nline3");
    });

    it("returns error for non-existent file", async () => {
      const result = await executeTextEditorCommand(backend, {
        command: "insert",
        path: "/nonexistent.ts",
        insert_line: 0,
        new_str: "content",
      });
      expect(result).toContain("Error");
    });
  });

  // ─── edge cases ─────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns error for unknown command", async () => {
      const result = await executeTextEditorCommand(backend, {
        command: "unknown_command" as any,
        path: "/src/test.ts",
      });
      expect(result).toContain("Error");
      expect(result).toContain("Unknown command");
    });

    it("str_replace preserves surrounding content exactly", async () => {
      const content = `import React from "react";\n\nfunction App() {\n  return <div>Hello</div>;\n}\n\nexport default App;`;
      await backend.write("/src/App.tsx", content);

      await executeTextEditorCommand(backend, {
        command: "str_replace",
        path: "/src/App.tsx",
        old_str: "  return <div>Hello</div>;",
        new_str: "  return <div>World</div>;",
      });

      const updated = await backend.read("/src/App.tsx");
      expect(updated).toBe(content.replace("Hello", "World"));
    });
  });
});
