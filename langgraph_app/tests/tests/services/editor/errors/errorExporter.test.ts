import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConsoleError, CombinedErrors } from "@types";

// Mock the dependencies at the module level
vi.mock("../../../app/services/editor/core/fileExporter", () => ({
  FileExporter: vi.fn().mockImplementation(() => ({
    export: vi.fn().mockResolvedValue("/tmp/test-export"),
    [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../../app/services/editor/core/websiteRunner", () => ({
  WebsiteRunner: vi.fn().mockImplementation(() => ({
    install: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getUrl: vi.fn().mockReturnValue("http://localhost:3000"),
    getStdout: vi.fn().mockReturnValue(["Server started"]),
    getStderr: vi.fn().mockReturnValue(["[vite] error"]),
  })),
}));

vi.mock("../../../app/services/editor/errors/browserErrorCapture", () => ({
  BrowserErrorCapture: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getErrors: vi.fn().mockReturnValue([]),
    getViteOverlayErrors: vi.fn().mockReturnValue([]),
  })),
}));

import { ErrorExporter } from "@services";

describe("ErrorExporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Combined Error Sources API", () => {
    it("run() returns CombinedErrors object with browser, server, and viteOverlay properties", async () => {
      const exporter = new ErrorExporter(1);
      const result = await exporter.run();

      // Should return a CombinedErrors object, not just ConsoleError[]
      expect(result).toHaveProperty("browser");
      expect(result).toHaveProperty("server");
      expect(result).toHaveProperty("viteOverlay");
    });

    it("CombinedErrors has hasErrors() method", async () => {
      const exporter = new ErrorExporter(1);
      const result = await exporter.run();

      expect(typeof result.hasErrors).toBe("function");
    });

    it("CombinedErrors has getFormattedReport() method", async () => {
      const exporter = new ErrorExporter(1);
      const result = await exporter.run();

      expect(typeof result.getFormattedReport).toBe("function");
    });
  });
});
