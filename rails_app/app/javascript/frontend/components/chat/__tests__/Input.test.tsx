import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../Input";

describe("Input", () => {
  describe("Textarea", () => {
    it("renders a textarea", () => {
      render(<Input.Textarea placeholder="Type here..." />);
      expect(screen.getByPlaceholderText("Type here...")).toBeInTheDocument();
    });

    it("accepts custom placeholder", () => {
      render(<Input.Textarea placeholder="Ask for changes..." />);
      expect(screen.getByPlaceholderText("Ask for changes...")).toBeInTheDocument();
    });

    it("is controlled by value prop", () => {
      const { rerender } = render(<Input.Textarea value="Hello" onChange={() => {}} />);
      expect(screen.getByRole("textbox")).toHaveValue("Hello");

      rerender(<Input.Textarea value="World" onChange={() => {}} />);
      expect(screen.getByRole("textbox")).toHaveValue("World");
    });

    it("calls onChange when typing", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Input.Textarea value="" onChange={handleChange} />);

      await user.type(screen.getByRole("textbox"), "H");
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe("SubmitButton", () => {
    it("renders a submit button", () => {
      render(<Input.SubmitButton />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("calls onClick when clicked", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Input.SubmitButton onClick={handleClick} />);

      await user.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalled();
    });

    it("is disabled when disabled prop is true", () => {
      render(<Input.SubmitButton disabled />);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("is disabled when loading", () => {
      render(<Input.SubmitButton loading />);
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("compound usage", () => {
    it("renders textarea and submit button together", () => {
      render(
        <Input.Root>
          <Input.Textarea placeholder="Type..." />
          <Input.SubmitButton />
        </Input.Root>
      );

      expect(screen.getByPlaceholderText("Type...")).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders with file upload button (Campaign style)", () => {
      render(
        <Input.Root>
          <Input.FileUpload />
          <Input.Textarea placeholder="Ask..." />
          <Input.SubmitButton />
        </Input.Root>
      );

      expect(screen.getAllByRole("button")).toHaveLength(2); // FileUpload + Submit
    });

    it("renders with refresh button (Campaign style)", () => {
      const handleRefresh = vi.fn();
      render(
        <Input.Root>
          <Input.Textarea placeholder="Ask..." />
          <Input.SubmitButton />
          <Input.RefreshButton onClick={handleRefresh} />
        </Input.Root>
      );

      expect(screen.getAllByRole("button")).toHaveLength(2); // Submit + Refresh
    });
  });
});
