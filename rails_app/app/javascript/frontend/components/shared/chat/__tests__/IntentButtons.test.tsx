import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntentButtons } from "../IntentButtons";

describe("IntentButtons", () => {
  describe("Root", () => {
    it("renders children", () => {
      render(
        <IntentButtons.Root>
          <button>Test</button>
        </IntentButtons.Root>
      );
      expect(screen.getByRole("button", { name: "Test" })).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <IntentButtons.Root className="custom-class" data-testid="root">
          <button>Test</button>
        </IntentButtons.Root>
      );
      expect(screen.getByTestId("root")).toHaveClass("custom-class");
    });

    it("has flex layout for button grouping", () => {
      render(
        <IntentButtons.Root data-testid="root">
          <button>Test</button>
        </IntentButtons.Root>
      );
      expect(screen.getByTestId("root")).toHaveClass("flex");
    });
  });

  describe("Button", () => {
    it("renders a button with label", () => {
      render(<IntentButtons.Button>Continue</IntentButtons.Button>);
      expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    });

    it("calls onClick when clicked", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<IntentButtons.Button onClick={handleClick}>Continue</IntentButtons.Button>);

      await user.click(screen.getByRole("button", { name: "Continue" }));
      expect(handleClick).toHaveBeenCalled();
    });

    it("can be disabled", () => {
      render(<IntentButtons.Button disabled>Continue</IntentButtons.Button>);
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it("supports primary variant", () => {
      render(<IntentButtons.Button variant="primary">Continue</IntentButtons.Button>);
      const button = screen.getByRole("button", { name: "Continue" });
      expect(button).toHaveClass("bg-primary-500");
    });

    it("supports secondary variant by default", () => {
      render(<IntentButtons.Button>Continue</IntentButtons.Button>);
      const button = screen.getByRole("button", { name: "Continue" });
      expect(button).toHaveClass("border");
    });
  });

  describe("compound usage", () => {
    it("renders multiple action buttons", () => {
      render(
        <IntentButtons.Root>
          <IntentButtons.Button variant="primary">Show Landing Page</IntentButtons.Button>
          <IntentButtons.Button>Continue Brainstorming</IntentButtons.Button>
          <IntentButtons.Button>Edit Response</IntentButtons.Button>
        </IntentButtons.Root>
      );

      expect(screen.getByRole("button", { name: "Show Landing Page" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continue Brainstorming" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Edit Response" })).toBeInTheDocument();
    });

    it("handles different actions for each button", async () => {
      const user = userEvent.setup();
      const handleShowLanding = vi.fn();
      const handleContinue = vi.fn();

      render(
        <IntentButtons.Root>
          <IntentButtons.Button variant="primary" onClick={handleShowLanding}>
            Show Landing Page
          </IntentButtons.Button>
          <IntentButtons.Button onClick={handleContinue}>Continue</IntentButtons.Button>
        </IntentButtons.Root>
      );

      await user.click(screen.getByRole("button", { name: "Show Landing Page" }));
      expect(handleShowLanding).toHaveBeenCalled();
      expect(handleContinue).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Continue" }));
      expect(handleContinue).toHaveBeenCalled();
    });
  });
});
