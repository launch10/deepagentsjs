import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PhaseProgress, type Phase } from "../PhaseProgress";

const createPhase = (overrides: Partial<Phase> = {}): Phase => ({
  id: "1",
  name: "TestPhase",
  description: "Test Phase Description",
  status: "pending",
  progress: 0,
  ...overrides,
});

describe("PhaseProgress", () => {
  describe("rendering", () => {
    it("renders nothing when phases array is empty", () => {
      render(<PhaseProgress phases={[]} />);
      expect(screen.queryByTestId("phase-progress")).not.toBeInTheDocument();
    });

    it("renders all phases by default", () => {
      const phases = [
        createPhase({ id: "1", name: "Phase1", description: "Phase One" }),
        createPhase({ id: "2", name: "Phase2", description: "Phase Two" }),
      ];

      render(<PhaseProgress phases={phases} />);
      expect(screen.getByText("Phase One")).toBeInTheDocument();
      expect(screen.getByText("Phase Two")).toBeInTheDocument();
    });

    it("renders phase descriptions", () => {
      const phases = [createPhase({ description: "Adding Analytics" })];

      render(<PhaseProgress phases={phases} />);
      expect(screen.getByText("Adding Analytics")).toBeInTheDocument();
    });
  });

  describe("status indicators", () => {
    it("renders pending status with gray circle", () => {
      const phases = [createPhase({ status: "pending" })];
      render(<PhaseProgress phases={phases} />);

      const phaseItem = screen.getByTestId("phase-TestPhase");
      expect(phaseItem).toHaveAttribute("data-status", "pending");
    });

    it("renders running status with spinning loader", () => {
      const phases = [createPhase({ status: "running" })];
      render(<PhaseProgress phases={phases} />);

      const phaseItem = screen.getByTestId("phase-TestPhase");
      expect(phaseItem).toHaveAttribute("data-status", "running");
      // Should have blue background
      expect(phaseItem).toHaveClass("bg-blue-50");
    });

    it("renders completed status with green checkmark", () => {
      const phases = [createPhase({ status: "completed" })];
      render(<PhaseProgress phases={phases} />);

      const phaseItem = screen.getByTestId("phase-TestPhase");
      expect(phaseItem).toHaveAttribute("data-status", "completed");
    });

    it("renders failed status with red X", () => {
      const phases = [createPhase({ status: "failed" })];
      render(<PhaseProgress phases={phases} />);

      const phaseItem = screen.getByTestId("phase-TestPhase");
      expect(phaseItem).toHaveAttribute("data-status", "failed");
      // Should have red background
      expect(phaseItem).toHaveClass("bg-red-50");
    });
  });

  describe("progress display", () => {
    it("shows progress percentage when running and progress > 0", () => {
      const phases = [createPhase({ status: "running", progress: 0.5 })];
      render(<PhaseProgress phases={phases} />);

      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("does not show progress when 0%", () => {
      const phases = [createPhase({ status: "running", progress: 0 })];
      render(<PhaseProgress phases={phases} />);

      expect(screen.queryByText("0%")).not.toBeInTheDocument();
    });

    it("does not show progress when 100%", () => {
      const phases = [createPhase({ status: "running", progress: 1 })];
      render(<PhaseProgress phases={phases} />);

      expect(screen.queryByText("100%")).not.toBeInTheDocument();
    });
  });

  describe("error display", () => {
    it("shows error message when phase has failed", () => {
      const phases = [
        createPhase({
          status: "failed",
          error: "Connection timeout",
        }),
      ];
      render(<PhaseProgress phases={phases} />);

      expect(screen.getByText("Connection timeout")).toBeInTheDocument();
    });

    it("does not show error when phase is not failed", () => {
      const phases = [
        createPhase({
          status: "running",
          error: "Some error",
        }),
      ];
      render(<PhaseProgress phases={phases} />);

      expect(screen.queryByText("Some error")).not.toBeInTheDocument();
    });
  });

  describe("showOnlyActive", () => {
    it("filters out pending phases when showOnlyActive is true", () => {
      const phases = [
        createPhase({ id: "1", name: "Active", description: "Active Phase", status: "running" }),
        createPhase({ id: "2", name: "Pending", description: "Pending Phase", status: "pending" }),
      ];

      render(<PhaseProgress phases={phases} showOnlyActive />);
      expect(screen.getByText("Active Phase")).toBeInTheDocument();
      expect(screen.queryByText("Pending Phase")).not.toBeInTheDocument();
    });

    it("shows pending phases with progress > 0 even when showOnlyActive", () => {
      const phases = [
        createPhase({
          status: "pending",
          progress: 0.5,
          description: "Partial Progress",
        }),
      ];

      render(<PhaseProgress phases={phases} showOnlyActive />);
      expect(screen.getByText("Partial Progress")).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("applies custom className", () => {
      const phases = [createPhase()];
      render(<PhaseProgress phases={phases} className="custom-class" />);

      expect(screen.getByTestId("phase-progress")).toHaveClass("custom-class");
    });
  });
});
