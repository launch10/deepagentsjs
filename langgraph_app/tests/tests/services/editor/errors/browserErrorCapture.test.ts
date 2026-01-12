import { describe, it, expect } from "vitest";
import { BrowserErrorCapture } from "@services";

describe("BrowserErrorCapture", () => {
  describe("Vite Overlay API", () => {
    it("exposes getViteOverlayErrors() method", () => {
      const capture = new BrowserErrorCapture("http://localhost:3000");

      expect(typeof capture.getViteOverlayErrors).toBe("function");
    });

    it("getViteOverlayErrors() returns an array", () => {
      const capture = new BrowserErrorCapture("http://localhost:3000");

      expect(Array.isArray(capture.getViteOverlayErrors())).toBe(true);
    });

    it("initially returns empty array for Vite overlay errors", () => {
      const capture = new BrowserErrorCapture("http://localhost:3000");

      expect(capture.getViteOverlayErrors()).toEqual([]);
    });
  });
});
