import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageList } from "../MessageList";
import { UserMessage } from "../UserMessage";
import { AIMessage } from "../AIMessage";

describe("MessageList", () => {
  describe("Root", () => {
    it("renders children", () => {
      render(
        <MessageList.Root>
          <div data-testid="child">Message content</div>
        </MessageList.Root>
      );
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <MessageList.Root className="custom-class" data-testid="list">
          <div>Content</div>
        </MessageList.Root>
      );
      expect(screen.getByTestId("list")).toHaveClass("custom-class");
    });

    it("has overflow-y-auto for scrolling", () => {
      render(
        <MessageList.Root data-testid="list">
          <div>Content</div>
        </MessageList.Root>
      );
      expect(screen.getByTestId("list")).toHaveClass("overflow-y-auto");
    });
  });

  describe("compound usage", () => {
    it("renders multiple messages in order", () => {
      render(
        <MessageList.Root>
          <UserMessage>User message 1</UserMessage>
          <AIMessage.Content>AI response 1</AIMessage.Content>
          <UserMessage>User message 2</UserMessage>
        </MessageList.Root>
      );

      const messages = screen.getAllByText(/message|response/i);
      expect(messages).toHaveLength(3);
    });

    it("renders brainstorm style (no bubbles)", () => {
      render(
        <MessageList.Root>
          <UserMessage>What about a coffee app?</UserMessage>
          <AIMessage.Content>Great idea! Let's explore that.</AIMessage.Content>
        </MessageList.Root>
      );

      expect(screen.getByText("What about a coffee app?")).toBeInTheDocument();
      expect(screen.getByText(/Great idea/)).toBeInTheDocument();
    });

    it("renders campaign style (with bubbles)", () => {
      render(
        <MessageList.Root>
          <UserMessage>Make the header blue</UserMessage>
          <AIMessage.Bubble>
            <AIMessage.Content>I've updated the header color.</AIMessage.Content>
          </AIMessage.Bubble>
        </MessageList.Root>
      );

      expect(screen.getByText("Make the header blue")).toBeInTheDocument();
      expect(screen.getByText(/updated the header/)).toBeInTheDocument();
    });
  });
});
