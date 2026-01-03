import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Messages } from "../messages";
import { UserMessage } from "../UserMessage";
import { AIMessage } from "../AIMessage";

describe("Messages.List", () => {
  describe("basic rendering", () => {
    it("renders children", () => {
      render(
        <Messages.List>
          <div data-testid="child">Message content</div>
        </Messages.List>
      );
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <Messages.List className="custom-class" data-testid="list">
          <div>Content</div>
        </Messages.List>
      );
      expect(screen.getByTestId("list")).toHaveClass("custom-class");
    });

    it("has overflow-y-auto for scrolling", () => {
      render(
        <Messages.List data-testid="list">
          <div>Content</div>
        </Messages.List>
      );
      expect(screen.getByTestId("list")).toHaveClass("overflow-y-auto");
    });
  });

  describe("compound usage", () => {
    it("renders multiple messages in order", () => {
      render(
        <Messages.List>
          <UserMessage>User message 1</UserMessage>
          <AIMessage.Content>AI response 1</AIMessage.Content>
          <UserMessage>User message 2</UserMessage>
        </Messages.List>
      );

      const messages = screen.getAllByText(/message|response/i);
      expect(messages).toHaveLength(3);
    });

    it("renders brainstorm style (no bubbles)", () => {
      render(
        <Messages.List>
          <UserMessage>What about a coffee app?</UserMessage>
          <AIMessage.Content>Great idea! Let's explore that.</AIMessage.Content>
        </Messages.List>
      );

      expect(screen.getByText("What about a coffee app?")).toBeInTheDocument();
      expect(screen.getByText(/Great idea/)).toBeInTheDocument();
    });

    it("renders campaign style (with bubbles)", () => {
      render(
        <Messages.List>
          <UserMessage>Make the header blue</UserMessage>
          <AIMessage.Bubble>
            <AIMessage.Content>I've updated the header color.</AIMessage.Content>
          </AIMessage.Bubble>
        </Messages.List>
      );

      expect(screen.getByText("Make the header blue")).toBeInTheDocument();
      expect(screen.getByText(/updated the header/)).toBeInTheDocument();
    });
  });
});
