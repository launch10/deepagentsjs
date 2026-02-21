import { describe, it, expect } from "vitest";
import { resolveContentScreen } from "../useDeployContentScreen";
import type { Deploy } from "@shared";

// Minimal helpers to avoid repeating boilerplate
const noTasks = undefined as Deploy.DeployGraphState["tasks"] | undefined;
const emptyTasks: Deploy.DeployGraphState["tasks"] = [];
const someTasks: Deploy.DeployGraphState["tasks"] = [
  { name: "DeployWebsite", status: "completed", result: {} },
];
const defaultInstructions: Deploy.DeployGraphState["instructions"] = {
  website: true,
  googleAds: false,
};

describe("resolveContentScreen", () => {
  // ─── Instruction mismatch fixes (Fix 3) ─────────────────────────────

  it("returns deploy-complete when instructions have different key order", () => {
    // REPRODUCES BUG: JSON.stringify fails when keys are in different order
    const pageInstructions = { website: true, googleAds: true };
    const railsInstructions = { googleAds: true, website: true }; // different order

    const result = resolveContentScreen(
      noTasks,
      undefined, // graph status not loaded yet
      defaultInstructions,
      "completed", // Rails says completed
      railsInstructions,
      pageInstructions
    );

    expect(result).toBe("deploy-complete");
  });

  it("returns deploy-complete when Rails has explicit false values", () => {
    // REPRODUCES BUG: JSON.stringify fails when Rails has extra false keys
    const pageInstructions = { website: true };
    const railsInstructions = { website: true, googleAds: false };

    const result = resolveContentScreen(
      noTasks,
      undefined,
      defaultInstructions,
      "completed",
      railsInstructions,
      pageInstructions
    );

    expect(result).toBe("deploy-complete");
  });

  it("ignores Rails status when instructions genuinely differ", () => {
    // Page expects googleAds but Rails deploy didn't include it
    const pageInstructions = { website: true, googleAds: true };
    const railsInstructions = { website: true }; // missing googleAds

    const result = resolveContentScreen(
      noTasks,
      undefined,
      defaultInstructions,
      "completed",
      railsInstructions,
      pageInstructions
    );

    // Should NOT be deploy-complete — stale deploy from different config
    expect(result).toBe("in-progress");
  });

  it("uses Rails status when instructions match exactly", () => {
    const pageInstructions = { website: true, googleAds: true };
    const railsInstructions = { website: true, googleAds: true };

    const result = resolveContentScreen(
      noTasks,
      undefined,
      defaultInstructions,
      "completed",
      railsInstructions,
      pageInstructions
    );

    expect(result).toBe("deploy-complete");
  });

  it("graph failed status wins over Rails completed status", () => {
    const pageInstructions = { website: true };
    const railsInstructions = { website: true };

    const result = resolveContentScreen(
      someTasks,
      "failed", // graph says failed
      defaultInstructions,
      "completed", // Rails says completed
      railsInstructions,
      pageInstructions
    );

    // Graph status takes priority over Rails — graph has more recent information
    expect(result).toBe("deploy-error");
  });

  it("graph failed status returns deploy-error", () => {
    const result = resolveContentScreen(
      someTasks,
      "failed",
      defaultInstructions,
      undefined,
      undefined,
      undefined
    );

    expect(result).toBe("deploy-error");
  });

  // ─── Connection error (Fix 1 integration) ───────────────────────────

  it("returns connection-error when historyFailed=true and no tasks", () => {
    const result = resolveContentScreen(
      noTasks,
      undefined,
      defaultInstructions,
      undefined,
      undefined,
      undefined,
      true // historyFailed
    );

    expect(result).toBe("connection-error");
  });

  it("returns connection-error when historyFailed=true and empty tasks", () => {
    const result = resolveContentScreen(
      emptyTasks,
      undefined,
      defaultInstructions,
      undefined,
      undefined,
      undefined,
      true
    );

    expect(result).toBe("connection-error");
  });

  it("returns in-progress when historyFailed=true but tasks exist", () => {
    const result = resolveContentScreen(
      someTasks,
      undefined,
      defaultInstructions,
      undefined,
      undefined,
      undefined,
      true
    );

    // Tasks exist, so we show progress even though history loading failed
    expect(result).toBe("in-progress");
  });

  // ─── Default behavior ───────────────────────────────────────────────

  it("returns in-progress when no state loaded", () => {
    const result = resolveContentScreen(
      noTasks,
      undefined,
      defaultInstructions,
      undefined,
      undefined,
      undefined
    );

    expect(result).toBe("in-progress");
  });

  it("returns deploy-complete when graph status is completed", () => {
    const result = resolveContentScreen(
      someTasks,
      "completed",
      defaultInstructions,
      undefined,
      undefined,
      undefined
    );

    expect(result).toBe("deploy-complete");
  });

  it("returns deploy-error for Rails failed status with matching instructions", () => {
    const pageInstructions = { website: true };
    const railsInstructions = { website: true };

    const result = resolveContentScreen(
      noTasks,
      undefined,
      defaultInstructions,
      "failed",
      railsInstructions,
      pageInstructions
    );

    expect(result).toBe("deploy-error");
  });
});
