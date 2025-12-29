import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrainstormMessage } from "../BrainstormMessage";
import type { MessageBlock } from "langgraph-ai-sdk-types";

// Helper to create typed blocks
function createTextBlock(text: string, id = "text-1"): MessageBlock<any> {
  return {
    id,
    type: "text",
    text,
  };
}

function createStructuredBlock(
  data: { type: string; text?: string; examples?: string[]; conclusion?: string; template?: string },
  id = "structured-1"
): MessageBlock<any> {
  return {
    id,
    type: "structured",
    data,
  };
}

function createToolCallBlock(id = "tool-1"): MessageBlock<any> {
  return {
    id,
    type: "tool_call",
    name: "some_tool",
    args: {},
  };
}

describe("BrainstormMessage", () => {
  describe("text blocks", () => {
    it("renders text block content", () => {
      const blocks = [createTextBlock("Hello from AI")];
      render(<BrainstormMessage blocks={blocks} />);
      expect(screen.getByText("Hello from AI")).toBeInTheDocument();
    });

    it("renders markdown in text blocks", () => {
      const blocks = [createTextBlock("**Bold text** and *italic*")];
      render(<BrainstormMessage blocks={blocks} />);
      expect(screen.getByText("Bold text")).toBeInTheDocument();
      expect(screen.getByRole("strong")).toBeInTheDocument();
    });

    it("does not render empty text blocks", () => {
      const blocks = [
        createTextBlock("", "t1"),
        createTextBlock("   ", "t2"),
        createTextBlock("Valid text", "t3"),
      ];
      render(<BrainstormMessage blocks={blocks} />);
      expect(screen.getByText("Valid text")).toBeInTheDocument();
      // Should only have one content div for the valid text
      const container = screen.getByTestId("ai-message");
      expect(container.children).toHaveLength(1);
    });

    it("renders multiple text blocks", () => {
      const blocks = [createTextBlock("First block", "t1"), createTextBlock("Second block", "t2")];
      render(<BrainstormMessage blocks={blocks} />);
      expect(screen.getByText("First block")).toBeInTheDocument();
      expect(screen.getByText("Second block")).toBeInTheDocument();
    });
  });

  describe("structured blocks - reply type", () => {
    it("renders reply block with text", () => {
      const blocks = [
        createStructuredBlock({
          type: "reply",
          text: "This is a reply message",
        }),
      ];
      render(<BrainstormMessage blocks={blocks} />);
      expect(screen.getByText("This is a reply message")).toBeInTheDocument();
    });

    it("renders reply block with examples", () => {
      const blocks = [
        createStructuredBlock({
          type: "reply",
          text: "Here are some examples:",
          examples: ["Example one", "Example two", "Example three"],
        }),
      ];
      render(<BrainstormMessage blocks={blocks} />);

      expect(screen.getByText("Here are some examples:")).toBeInTheDocument();
      expect(screen.getByText("Example answers:")).toBeInTheDocument();
      expect(screen.getByText("Example one")).toBeInTheDocument();
      expect(screen.getByText("Example two")).toBeInTheDocument();
      expect(screen.getByText("Example three")).toBeInTheDocument();
    });

    it("renders example labels correctly", () => {
      const blocks = [
        createStructuredBlock({
          type: "reply",
          examples: ["First", "Second"],
        }),
      ];
      render(<BrainstormMessage blocks={blocks} />);

      expect(screen.getByText("Example 1")).toBeInTheDocument();
      expect(screen.getByText("Example 2")).toBeInTheDocument();
    });

    it("calls onExampleClick when example is clicked", () => {
      const handleExampleClick = vi.fn();
      const blocks = [
        createStructuredBlock({
          type: "reply",
          examples: ["Click me example"],
        }),
      ];
      render(<BrainstormMessage blocks={blocks} onExampleClick={handleExampleClick} />);

      const exampleButton = screen.getByText("Click me example");
      fireEvent.click(exampleButton);

      expect(handleExampleClick).toHaveBeenCalledWith("Click me example");
    });

    it("renders reply block with conclusion", () => {
      const blocks = [
        createStructuredBlock({
          type: "reply",
          text: "Main text",
          conclusion: "This is the conclusion",
        }),
      ];
      render(<BrainstormMessage blocks={blocks} />);

      expect(screen.getByText("Main text")).toBeInTheDocument();
      expect(screen.getByText("This is the conclusion")).toBeInTheDocument();
    });

    it("renders reply block with template", () => {
      const blocks = [
        createStructuredBlock({
          type: "reply",
          text: "Main text",
          template: "This is the template content",
        }),
      ];
      render(<BrainstormMessage blocks={blocks} />);

      expect(screen.getByText("Main text")).toBeInTheDocument();
      expect(screen.getByText("Template:")).toBeInTheDocument();
      expect(screen.getByText("This is the template content")).toBeInTheDocument();
    });

    it("renders complete reply block with all fields", () => {
      const blocks = [
        createStructuredBlock({
          type: "reply",
          text: "Main text here",
          examples: ["Example A"],
          conclusion: "Conclusion text",
          template: "Template text",
        }),
      ];
      render(<BrainstormMessage blocks={blocks} />);

      expect(screen.getByText("Main text here")).toBeInTheDocument();
      expect(screen.getByText("Example A")).toBeInTheDocument();
      expect(screen.getByText("Conclusion text")).toBeInTheDocument();
      expect(screen.getByText("Template text")).toBeInTheDocument();
    });
  });

  describe("structured blocks - helpMe type", () => {
    it("renders helpMe block with text", () => {
      const blocks = [
        createStructuredBlock({
          type: "helpMe",
          text: "Let me help you with that",
        }),
      ];
      render(<BrainstormMessage blocks={blocks} />);
      expect(screen.getByText("Let me help you with that")).toBeInTheDocument();
    });

    it("renders helpMe block with examples", () => {
      const blocks = [
        createStructuredBlock({
          type: "helpMe",
          examples: ["Help example 1", "Help example 2"],
        }),
      ];
      render(<BrainstormMessage blocks={blocks} />);

      expect(screen.getByText("Help example 1")).toBeInTheDocument();
      expect(screen.getByText("Help example 2")).toBeInTheDocument();
    });
  });

  describe("tool call blocks", () => {
    it("does not render tool call blocks (hidden in UI)", () => {
      const blocks = [createToolCallBlock()];
      render(<BrainstormMessage blocks={blocks} />);

      const container = screen.getByTestId("ai-message");
      // Tool calls should be hidden, so container should be empty
      expect(container.children).toHaveLength(0);
    });

    it("renders other blocks but hides tool calls", () => {
      const blocks = [
        createTextBlock("Visible text"),
        createToolCallBlock(),
        createStructuredBlock({ type: "reply", text: "Visible reply" }),
      ];
      render(<BrainstormMessage blocks={blocks} />);

      expect(screen.getByText("Visible text")).toBeInTheDocument();
      expect(screen.getByText("Visible reply")).toBeInTheDocument();
    });
  });

  describe("empty and invalid blocks", () => {
    it("handles empty structured block data", () => {
      const blocks = [
        {
          id: "empty-1",
          type: "structured" as const,
          data: {},
        },
      ];
      render(<BrainstormMessage blocks={blocks as MessageBlock<any>[]} />);

      const container = screen.getByTestId("ai-message");
      expect(container.children).toHaveLength(0);
    });

    it("handles unknown block types gracefully", () => {
      const blocks = [
        {
          id: "unknown-1",
          type: "unknown_type",
        },
      ];
      render(<BrainstormMessage blocks={blocks as MessageBlock<any>[]} />);

      const container = screen.getByTestId("ai-message");
      expect(container.children).toHaveLength(0);
    });

    it("handles unknown structured data types", () => {
      const blocks = [
        createStructuredBlock({
          type: "unknownType",
          text: "Should not render",
        }),
      ];
      render(<BrainstormMessage blocks={blocks} />);

      const container = screen.getByTestId("ai-message");
      expect(container.children).toHaveLength(0);
    });
  });

  describe("state variants", () => {
    it("renders with active state by default", () => {
      const blocks = [createTextBlock("Active message")];
      render(<BrainstormMessage blocks={blocks} />);

      const content = screen.getByText("Active message");
      expect(content.closest("div")).not.toHaveClass("text-base-300");
    });

    it("applies inactive styling when isActive is false", () => {
      const blocks = [createTextBlock("Inactive message")];
      render(<BrainstormMessage blocks={blocks} isActive={false} />);

      const content = screen.getByText("Inactive message");
      expect(content.closest("div")).toHaveClass("text-base-300");
    });

    it("applies inactive styling to structured blocks", () => {
      const blocks = [
        createStructuredBlock({
          type: "reply",
          text: "Inactive structured",
        }),
      ];
      render(<BrainstormMessage blocks={blocks} isActive={false} />);

      const content = screen.getByText("Inactive structured");
      expect(content.closest("div")).toHaveClass("text-base-300");
    });
  });

  describe("component structure", () => {
    it("has correct data-testid attribute", () => {
      const blocks = [createTextBlock("Test")];
      render(<BrainstormMessage blocks={blocks} />);

      expect(screen.getByTestId("ai-message")).toBeInTheDocument();
    });

    it("has correct data-role attribute", () => {
      const blocks = [createTextBlock("Test")];
      render(<BrainstormMessage blocks={blocks} />);

      const message = screen.getByTestId("ai-message");
      expect(message).toHaveAttribute("data-role", "assistant");
    });

    it("applies space-y-3 for block spacing", () => {
      const blocks = [createTextBlock("Test")];
      render(<BrainstormMessage blocks={blocks} />);

      const message = screen.getByTestId("ai-message");
      expect(message).toHaveClass("space-y-3");
    });
  });
});
