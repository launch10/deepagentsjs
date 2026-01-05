import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserMessage } from "../UserMessage";

describe("UserMessage", () => {
  it("renders message content", () => {
    render(<UserMessage>Hello, world!</UserMessage>);
    expect(screen.getByText("Hello, world!")).toBeInTheDocument();
  });

  it("applies user message styling (right-aligned, gray bubble)", () => {
    render(<UserMessage>Test message</UserMessage>);
    const message = screen.getByText("Test message");
    expect(message.closest("div")).toHaveClass("bg-neutral-100");
  });

  it("preserves whitespace in messages", () => {
    render(<UserMessage>{"Line 1\nLine 2"}</UserMessage>);
    const message = screen.getByText(/Line 1/);
    expect(message).toHaveClass("whitespace-pre-wrap");
  });

  it("accepts custom className", () => {
    render(<UserMessage className="custom-class">Message</UserMessage>);
    const message = screen.getByText("Message");
    expect(message.closest("div")).toHaveClass("custom-class");
  });
});
