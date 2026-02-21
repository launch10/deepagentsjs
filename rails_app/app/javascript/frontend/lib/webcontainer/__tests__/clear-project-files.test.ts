import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebContainerManager } from "../manager";

/**
 * We can't boot a real WebContainer in unit tests, so we test
 * clearProjectFiles by injecting a mock instance into the singleton.
 */

function createMockFs() {
  const files = new Map<string, { name: string; isDirectory: () => boolean }>();
  return {
    _files: files,
    addEntry(name: string, isDir = true) {
      files.set(name, { name, isDirectory: () => isDir });
    },
    readdir: vi.fn(async (_path: string, _opts?: any) => {
      return Array.from(files.values());
    }),
    rm: vi.fn(async (_path: string, _opts?: any) => {
      const name = _path.replace("/", "");
      files.delete(name);
    }),
    readFile: vi.fn(async () => JSON.stringify({ dependencies: {}, devDependencies: {} })),
  };
}

describe("WebContainerManager.clearProjectFiles", () => {
  const manager = WebContainerManager as any;
  let mockFs: ReturnType<typeof createMockFs>;

  beforeEach(() => {
    mockFs = createMockFs();
    // Inject a mock WebContainer instance
    manager["instance"] = { fs: mockFs } as any;
    manager["loadProjectCount"] = 0;
  });

  it("is a function on the manager", () => {
    expect(typeof manager.clearProjectFiles).toBe("function");
  });

  it("removes user project files but preserves node_modules, .npm, .config", async () => {
    mockFs.addEntry("node_modules");
    mockFs.addEntry(".npm");
    mockFs.addEntry(".config");
    mockFs.addEntry("src");
    mockFs.addEntry("index.html", false);
    mockFs.addEntry("package.json", false);
    mockFs.addEntry("vite.config.ts", false);

    await manager.clearProjectFiles();

    // Should have removed src, index.html, package.json, vite.config.ts
    expect(mockFs.rm).toHaveBeenCalledWith("/src", { recursive: true, force: true });
    expect(mockFs.rm).toHaveBeenCalledWith("/index.html", { recursive: true, force: true });
    expect(mockFs.rm).toHaveBeenCalledWith("/package.json", { recursive: true, force: true });
    expect(mockFs.rm).toHaveBeenCalledWith("/vite.config.ts", { recursive: true, force: true });

    // Should NOT have removed node_modules, .npm, .config
    expect(mockFs.rm).not.toHaveBeenCalledWith("/node_modules", expect.anything());
    expect(mockFs.rm).not.toHaveBeenCalledWith("/.npm", expect.anything());
    expect(mockFs.rm).not.toHaveBeenCalledWith("/.config", expect.anything());
  });

  it("does not reset loadProjectCount (resetForNewProject handles that)", async () => {
    manager["loadProjectCount"] = 5;

    await manager.clearProjectFiles();

    expect(manager["loadProjectCount"]).toBe(5);
  });

  it("resetForNewProject resets loadProjectCount to 0", () => {
    manager["loadProjectCount"] = 5;

    manager.resetForNewProject();

    expect(manager["loadProjectCount"]).toBe(0);
  });

  it("is a no-op when instance is null (container not booted)", async () => {
    manager["instance"] = null;

    // Should not throw
    await expect(manager.clearProjectFiles()).resolves.toBeUndefined();
  });

  it("does not throw if fs.readdir fails", async () => {
    mockFs.readdir.mockRejectedValueOnce(new Error("filesystem error"));

    await expect(manager.clearProjectFiles()).resolves.toBeUndefined();
  });

  it("handles entries returned as strings (older WebContainer API)", async () => {
    mockFs.readdir.mockResolvedValueOnce(["node_modules", "src", "index.html"]);

    await manager.clearProjectFiles();

    expect(mockFs.rm).toHaveBeenCalledWith("/src", { recursive: true, force: true });
    expect(mockFs.rm).toHaveBeenCalledWith("/index.html", { recursive: true, force: true });
    expect(mockFs.rm).not.toHaveBeenCalledWith("/node_modules", expect.anything());
  });
});
