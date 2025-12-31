import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThinkingIndicator } from "../ThinkingIndicator";

describe("ThinkingIndicator", () => {
  it("renders thinking text", () => {
    render(<ThinkingIndicator />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it("accepts custom text", () => {
    render(<ThinkingIndicator text="Generating ideas" />);
    // Component adds "..." after text, so "Generating ideas" becomes "Generating ideas..."
    expect(screen.getByText("Generating ideas...")).toBeInTheDocument();
  });

  it("shows spinner animation", () => {
    render(<ThinkingIndicator />);
    // Component uses a spinning SVG circle animation instead of bouncing dots
    const spinner = screen.getByTestId("thinking-indicator").querySelector("svg.animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<ThinkingIndicator className="custom-class" data-testid="indicator" />);
    expect(screen.getByTestId("indicator")).toHaveClass("custom-class");
  });

  describe("variants", () => {
    it("renders default variant", () => {
      render(<ThinkingIndicator data-testid="indicator" />);
      expect(screen.getByTestId("indicator")).not.toHaveClass("bg-base-200");
    });

    it("renders bubble variant", () => {
      render(<ThinkingIndicator variant="bubble" data-testid="indicator" />);
      expect(screen.getByTestId("indicator")).toHaveClass("bg-base-200");
    });
  });

  describe("stages", () => {
    it("shows stage when provided", () => {
      render(<ThinkingIndicator stage="Researching competitor sites" />);
      expect(screen.getByText("Researching competitor sites")).toBeInTheDocument();
    });

    it("shows both text and stage", () => {
      render(<ThinkingIndicator text="Working" stage="Analyzing data" />);
      // Component adds "..." after text
      expect(screen.getByText("Working...")).toBeInTheDocument();
      expect(screen.getByText("Analyzing data")).toBeInTheDocument();
    });
  });
});
