import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewProjectButton } from "../NewProjectButton";

// Mock Inertia router
const mockVisit = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: {
    visit: (url: string) => mockVisit(url),
  },
}));

describe("NewProjectButton", () => {
  beforeEach(() => {
    mockVisit.mockClear();
  });

  describe("rendering", () => {
    it("renders the button with New Project text when not collapsed", () => {
      render(<NewProjectButton isCollapsed={false} />);

      expect(screen.getByTestId("new-project-link")).toBeInTheDocument();
      expect(screen.getByText("New Project")).toBeInTheDocument();
    });

    it("hides New Project text when collapsed", () => {
      render(<NewProjectButton isCollapsed={true} />);

      expect(screen.getByTestId("new-project-link")).toBeInTheDocument();
      expect(screen.queryByText("New Project")).not.toBeInTheDocument();
    });

    it("renders the plus icon", () => {
      render(<NewProjectButton />);

      // The icon is inside a span with white background
      const iconContainer = screen.getByTestId("new-project-link").querySelector("span");
      expect(iconContainer).toBeInTheDocument();
      expect(iconContainer).toHaveClass("bg-white", "rounded-full");
    });
  });

  describe("navigation behavior", () => {
    it("navigates to /projects/new on click", async () => {
      const user = userEvent.setup();
      render(<NewProjectButton />);

      await user.click(screen.getByTestId("new-project-link"));

      expect(mockVisit).toHaveBeenCalledWith("/projects/new");
      expect(mockVisit).toHaveBeenCalledTimes(1);
    });

    it("is a button element (not a link)", () => {
      render(<NewProjectButton />);

      const button = screen.getByTestId("new-project-link");
      expect(button.tagName).toBe("BUTTON");
    });
  });

  describe("styles", () => {
    it("applies correct flex styles when not collapsed", () => {
      render(<NewProjectButton isCollapsed={false} />);

      const button = screen.getByTestId("new-project-link");
      expect(button).toHaveClass("flex", "items-center", "gap-3");
      expect(button).not.toHaveClass("justify-center");
    });

    it("applies justify-center when collapsed", () => {
      render(<NewProjectButton isCollapsed={true} />);

      const button = screen.getByTestId("new-project-link");
      expect(button).toHaveClass("justify-center");
    });
  });
});
