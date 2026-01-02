import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandButtons } from "../CommandButtons";

describe("CommandButtons", () => {
  describe("Root", () => {
    it("renders children", () => {
      render(
        <CommandButtons.Root>
          <button>Test</button>
        </CommandButtons.Root>
      );
      expect(screen.getByRole("button", { name: "Test" })).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <CommandButtons.Root className="custom-class" data-testid="root">
          <button>Test</button>
        </CommandButtons.Root>
      );
      expect(screen.getByTestId("root")).toHaveClass("custom-class");
    });

    it("has flex layout for button grouping", () => {
      render(
        <CommandButtons.Root data-testid="root">
          <button>Test</button>
        </CommandButtons.Root>
      );
      expect(screen.getByTestId("root")).toHaveClass("flex");
    });
  });

  describe("Button", () => {
    it("renders a button with label", () => {
      render(<CommandButtons.Button>Continue</CommandButtons.Button>);
      expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    });

    it("calls onClick when clicked", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<CommandButtons.Button onClick={handleClick}>Continue</CommandButtons.Button>);

      await user.click(screen.getByRole("button", { name: "Continue" }));
      expect(handleClick).toHaveBeenCalled();
    });

    it("can be disabled", () => {
      render(<CommandButtons.Button disabled>Continue</CommandButtons.Button>);
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    });

    it("supports primary variant", () => {
      render(<CommandButtons.Button variant="primary">Continue</CommandButtons.Button>);
      const button = screen.getByRole("button", { name: "Continue" });
      expect(button).toHaveClass("bg-primary-500");
    });

    it("supports secondary variant by default", () => {
      render(<CommandButtons.Button>Continue</CommandButtons.Button>);
      const button = screen.getByRole("button", { name: "Continue" });
      expect(button).toHaveClass("border");
    });
  });

  describe("compound usage", () => {
    it("renders multiple action buttons", () => {
      render(
        <CommandButtons.Root>
          <CommandButtons.Button variant="primary">Show Landing Page</CommandButtons.Button>
          <CommandButtons.Button>Continue Brainstorming</CommandButtons.Button>
          <CommandButtons.Button>Edit Response</CommandButtons.Button>
        </CommandButtons.Root>
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
        <CommandButtons.Root>
          <CommandButtons.Button variant="primary" onClick={handleShowLanding}>
            Show Landing Page
          </CommandButtons.Button>
          <CommandButtons.Button onClick={handleContinue}>Continue</CommandButtons.Button>
        </CommandButtons.Root>
      );

      await user.click(screen.getByRole("button", { name: "Show Landing Page" }));
      expect(handleShowLanding).toHaveBeenCalled();
      expect(handleContinue).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Continue" }));
      expect(handleContinue).toHaveBeenCalled();
    });
  });
});
