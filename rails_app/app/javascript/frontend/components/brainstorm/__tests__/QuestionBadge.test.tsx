import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestionBadge } from "../conversation-page/QuestionBadge";

describe("QuestionBadge", () => {
  it("renders the question count", () => {
    render(<QuestionBadge current={1} total={5} />);
    expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();
  });

  it("renders different question numbers", () => {
    const { rerender } = render(<QuestionBadge current={3} total={10} />);
    expect(screen.getByText("Question 3 of 10")).toBeInTheDocument();

    rerender(<QuestionBadge current={7} total={7} />);
    expect(screen.getByText("Question 7 of 7")).toBeInTheDocument();
  });

  it("handles edge case of first question", () => {
    render(<QuestionBadge current={1} total={1} />);
    expect(screen.getByText("Question 1 of 1")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<QuestionBadge current={1} total={5} className="custom-class" />);
    const badge = screen.getByText("Question 1 of 5").closest("div");
    expect(badge).toHaveClass("custom-class");
  });

  it("has appropriate purple styling", () => {
    render(<QuestionBadge current={1} total={5} />);
    const badge = screen.getByText("Question 1 of 5").closest("div");
    // Should have primary-300 border for purple styling
    expect(badge).toHaveClass("border-primary-300");
  });

  it("has rounded pill styling", () => {
    render(<QuestionBadge current={2} total={4} />);
    const badge = screen.getByText("Question 2 of 4").closest("div");
    expect(badge).toHaveClass("rounded-3xl");
  });

  it("renders with proper inline-flex layout", () => {
    render(<QuestionBadge current={1} total={3} />);
    const badge = screen.getByText("Question 1 of 3").closest("div");
    expect(badge).toHaveClass("inline-flex");
    expect(badge).toHaveClass("items-center");
    expect(badge).toHaveClass("justify-center");
  });
});
