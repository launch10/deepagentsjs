import { describe, it, expect } from "vitest";
import { WebsiteRunner } from "@services";

describe("WebsiteRunner", () => {
  describe("Output Capture API", () => {
    it("exposes getStdout() method", () => {
      const runner = new WebsiteRunner("/tmp/test");

      expect(typeof runner.getStdout).toBe("function");
    });

    it("exposes getStderr() method", () => {
      const runner = new WebsiteRunner("/tmp/test");

      expect(typeof runner.getStderr).toBe("function");
    });

    it("getStdout() returns an array", () => {
      const runner = new WebsiteRunner("/tmp/test");

      expect(Array.isArray(runner.getStdout())).toBe(true);
    });

    it("getStderr() returns an array", () => {
      const runner = new WebsiteRunner("/tmp/test");

      expect(Array.isArray(runner.getStderr())).toBe(true);
    });

    it("initially returns empty arrays", () => {
      const runner = new WebsiteRunner("/tmp/test");

      expect(runner.getStdout()).toEqual([]);
      expect(runner.getStderr()).toEqual([]);
    });
  });
});
