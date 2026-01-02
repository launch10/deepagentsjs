import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AIMessage } from "../AIMessage";

describe("AIMessage", () => {
  describe("Content", () => {
    it("renders message content", () => {
      render(<AIMessage.Content>Hello from AI</AIMessage.Content>);
      expect(screen.getByText("Hello from AI")).toBeInTheDocument();
    });

    it("renders markdown content", () => {
      render(<AIMessage.Content>**Bold text**</AIMessage.Content>);
      expect(screen.getByText("Bold text")).toBeInTheDocument();
      expect(screen.getByRole("strong")).toBeInTheDocument();
    });
  });

  describe("Bubble", () => {
    it("wraps content in a bubble", () => {
      render(
        <AIMessage.Bubble>
          <AIMessage.Content>Wrapped content</AIMessage.Content>
        </AIMessage.Bubble>
      );
      const content = screen.getByText("Wrapped content");
      // Go up to the Content div, then to the Bubble div
      const bubbleWrapper = content.closest("div")?.parentElement;
      expect(bubbleWrapper).toHaveClass("bg-base-200");
    });
  });

  describe("compound usage", () => {
    it("renders without bubble (brainstorm style)", () => {
      render(<AIMessage.Content>No bubble message</AIMessage.Content>);
      const content = screen.getByText("No bubble message");
      expect(content.closest("div")).not.toHaveClass("bg-base-200");
    });

    it("renders with bubble (campaign style)", () => {
      render(
        <AIMessage.Bubble>
          <AIMessage.Content>With bubble message</AIMessage.Content>
        </AIMessage.Bubble>
      );
      const bubble = screen.getByText("With bubble message").closest("div")?.parentElement;
      expect(bubble).toHaveClass("bg-base-200");
    });
  });

  describe("state variants", () => {
    it("applies inactive styling when inactive", () => {
      render(<AIMessage.Content state="inactive">Inactive message</AIMessage.Content>);
      const content = screen.getByText("Inactive message");
      expect(content.closest("div")).toHaveClass("text-base-300");
    });

    it("applies active styling by default", () => {
      render(<AIMessage.Content>Active message</AIMessage.Content>);
      const content = screen.getByText("Active message");
      expect(content.closest("div")).not.toHaveClass("text-base-300");
    });
  });
});
