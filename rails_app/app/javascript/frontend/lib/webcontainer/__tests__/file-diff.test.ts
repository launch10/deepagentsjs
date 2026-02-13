import { describe, it, expect } from "vitest";
import { diffFileMap } from "../file-utils";
import type { Website } from "@shared";

function makeFile(content: string, modified_at = "2026-01-01T00:00:00Z"): Website.File {
  return { content, created_at: "2026-01-01T00:00:00Z", modified_at };
}

describe("diffFileMap", () => {
  it("returns all files when previous is null (initial mount)", () => {
    const current: Website.FileMap = {
      "/index.html": makeFile("<html></html>"),
      "/src/App.tsx": makeFile("export default function App() {}"),
    };

    const result = diffFileMap(null, current);
    expect(result).toEqual(current);
  });

  it("returns null when files are identical", () => {
    const files: Website.FileMap = {
      "/index.html": makeFile("<html></html>"),
      "/src/App.tsx": makeFile("export default function App() {}"),
    };

    const result = diffFileMap(files, files);
    expect(result).toBeNull();
  });

  it("returns null when content is identical but objects are different references", () => {
    const previous: Website.FileMap = {
      "/index.html": makeFile("<html></html>"),
      "/src/App.tsx": makeFile("export default function App() {}"),
    };
    const current: Website.FileMap = {
      "/index.html": makeFile("<html></html>"),
      "/src/App.tsx": makeFile("export default function App() {}"),
    };

    const result = diffFileMap(previous, current);
    expect(result).toBeNull();
  });

  it("returns only changed files when some content differs", () => {
    const previous: Website.FileMap = {
      "/index.html": makeFile("<html></html>"),
      "/src/App.tsx": makeFile("export default function App() {}"),
      "/src/components/Hero.tsx": makeFile("old hero"),
    };
    const current: Website.FileMap = {
      "/index.html": makeFile("<html></html>"),
      "/src/App.tsx": makeFile("export default function App() {}"),
      "/src/components/Hero.tsx": makeFile("new hero"),
    };

    const result = diffFileMap(previous, current);
    expect(result).toEqual({
      "/src/components/Hero.tsx": makeFile("new hero"),
    });
  });

  it("includes newly added files", () => {
    const previous: Website.FileMap = {
      "/index.html": makeFile("<html></html>"),
    };
    const current: Website.FileMap = {
      "/index.html": makeFile("<html></html>"),
      "/src/NewComponent.tsx": makeFile("new component"),
    };

    const result = diffFileMap(previous, current);
    expect(result).toEqual({
      "/src/NewComponent.tsx": makeFile("new component"),
    });
  });

  it("ignores deleted files (mount is additive, not destructive)", () => {
    const previous: Website.FileMap = {
      "/index.html": makeFile("<html></html>"),
      "/src/OldComponent.tsx": makeFile("old component"),
    };
    const current: Website.FileMap = {
      "/index.html": makeFile("<html></html>"),
    };

    const result = diffFileMap(previous, current);
    expect(result).toBeNull();
  });

  it("detects changes based on content, not modified_at", () => {
    const previous: Website.FileMap = {
      "/src/App.tsx": makeFile("same content", "2026-01-01T00:00:00Z"),
    };
    const current: Website.FileMap = {
      "/src/App.tsx": makeFile("same content", "2026-02-01T00:00:00Z"),
    };

    const result = diffFileMap(previous, current);
    expect(result).toBeNull();
  });

  it("handles multiple changed files at once", () => {
    const previous: Website.FileMap = {
      "/index.html": makeFile("<html>old</html>"),
      "/src/App.tsx": makeFile("old app"),
      "/src/components/Hero.tsx": makeFile("old hero"),
      "/src/components/Footer.tsx": makeFile("same footer"),
    };
    const current: Website.FileMap = {
      "/index.html": makeFile("<html>new</html>"),
      "/src/App.tsx": makeFile("new app"),
      "/src/components/Hero.tsx": makeFile("new hero"),
      "/src/components/Footer.tsx": makeFile("same footer"),
    };

    const result = diffFileMap(previous, current);
    expect(result).toEqual({
      "/index.html": makeFile("<html>new</html>"),
      "/src/App.tsx": makeFile("new app"),
      "/src/components/Hero.tsx": makeFile("new hero"),
    });
  });
});
