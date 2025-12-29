import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopicBadge } from "../TopicBadge";

describe("TopicBadge", () => {
  it("renders the topic label", () => {
    render(<TopicBadge topic="Problem" />);
    expect(screen.getByText("Problem")).toBeInTheDocument();
  });

  it("renders different topics", () => {
    const { rerender } = render(<TopicBadge topic="Solution" />);
    expect(screen.getByText("Solution")).toBeInTheDocument();

    rerender(<TopicBadge topic="Target Audience" />);
    expect(screen.getByText("Target Audience")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<TopicBadge topic="Problem" className="custom-class" />);
    const badge = screen.getByText("Problem").closest("div");
    expect(badge).toHaveClass("custom-class");
  });

  it("has appropriate styling for visibility", () => {
    render(<TopicBadge topic="Problem" />);
    const badge = screen.getByText("Problem").closest("div");
    // Should have some background color for visibility
    expect(badge).toHaveClass("bg-primary-100");
  });

  describe("variants", () => {
    it("renders active variant by default", () => {
      render(<TopicBadge topic="Problem" />);
      const badge = screen.getByText("Problem").closest("div");
      expect(badge).toHaveClass("bg-primary-100");
    });

    it("renders completed variant", () => {
      render(<TopicBadge topic="Problem" variant="completed" />);
      const badge = screen.getByText("Problem").closest("div");
      expect(badge).toHaveClass("bg-success-100");
    });

    it("renders pending variant", () => {
      render(<TopicBadge topic="Solution" variant="pending" />);
      const badge = screen.getByText("Solution").closest("div");
      expect(badge).toHaveClass("bg-neutral-100");
    });
  });
});
