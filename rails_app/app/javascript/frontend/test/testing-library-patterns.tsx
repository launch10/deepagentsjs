/**
 * Testing Library Best Practices for Launch10
 *
 * This file documents patterns for testing React components using @testing-library/react
 * Focus on testing behavior, not implementation details.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * QUERY PRIORITY (in order of preference)
 *
 * 1. getByRole - Most accessible, recommended
 * 2. getByLabelText - For form fields
 * 3. getByPlaceholderText - For form inputs
 * 4. getByText - For text content
 * 5. getByTestId - Last resort (leaks implementation)
 */

// ✅ GOOD: Query by role (accessible)
const button = screen.getByRole("button", { name: /submit/i });
const input = screen.getByRole("textbox", { name: /message/i });
const heading = screen.getByRole("heading", { level: 1 });

// ❌ BAD: Query by className (implementation detail)
// screen.getByRole("button") // Much better

/**
 * PATTERN: Testing Compound Components
 *
 * Test each sub-component, then test composition.
 */
describe("CompoundComponent", () => {
  // Test subcomponent in isolation
  describe("Content", () => {
    it("renders content", () => {
      render(<Component.Content>Text</Component.Content>);
      expect(screen.getByText("Text")).toBeInTheDocument();
    });

    it("applies state styling", () => {
      render(<Component.Content state="inactive">Text</Component.Content>);
      const el = screen.getByText("Text");
      // Query the styled element, not just presence
      expect(el.className).toMatch(/opacity/);
    });
  });

  // Test composition
  describe("with Wrapper", () => {
    it("renders with wrapper", () => {
      render(
        <Component.Wrapper>
          <Component.Content>Text</Component.Content>
        </Component.Wrapper>
      );
      expect(screen.getByText("Text")).toBeInTheDocument();
    });
  });
});

/**
 * PATTERN: Testing Message Blocks
 */
describe("MessageBlockRenderer", () => {
  it("renders text blocks", () => {
    const block: TextMessageBlock = {
      id: "1",
      type: "text",
      text: "Hello world",
    };
    render(<BlockRenderer block={block} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders structured blocks", () => {
    const block: StructuredMessageBlock = {
      id: "2",
      type: "structured",
      data: {
        type: "reply",
        text: "Here's a response",
        examples: ["Example 1", "Example 2"],
      },
    };
    render(<BlockRenderer block={block} />);
    expect(screen.getByText("Here's a response")).toBeInTheDocument();
    expect(screen.getByText("Example 1")).toBeInTheDocument();
  });

  it("renders tool call blocks with status", () => {
    const block: ToolCallMessageBlock = {
      id: "3",
      type: "tool_call",
      toolName: "search",
      state: "pending",
    };
    render(<BlockRenderer block={block} />);
    expect(screen.getByText("search")).toBeInTheDocument();
  });
});

/**
 * PATTERN: Testing User Interactions
 *
 * Use userEvent for more realistic interactions
 */
describe("UserInteraction", () => {
  it("handles click", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<button onClick={handleClick}>Click me</button>);

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalled();
  });

  it("handles form submission", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Enter text" />
        <button type="submit">Submit</button>
      </form>
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "Hello");
    await user.click(screen.getByRole("button"));

    expect(handleSubmit).toHaveBeenCalled();
  });

  it("handles keyboard events", async () => {
    const user = userEvent.setup();
    const handleEnter = vi.fn();
    render(<input onKeyDown={(e) => e.key === "Enter" && handleEnter()} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "text");
    await user.keyboard("{Enter}");

    expect(handleEnter).toHaveBeenCalled();
  });
});

/**
 * PATTERN: Testing Async Behavior
 */
describe("AsyncBehavior", () => {
  it("waits for element to appear", async () => {
    render(<AsyncComponent />);

    // Element doesn't exist yet
    expect(screen.queryByText("Loaded")).not.toBeInTheDocument();

    // Wait for element
    await waitFor(() => {
      expect(screen.getByText("Loaded")).toBeInTheDocument();
    });
  });

  it("waits for element to disappear", async () => {
    render(<AsyncComponent showLoading={true} />);

    // Initially shown
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // Wait for it to go away
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });
});

/**
 * PATTERN: Testing Store Integration
 *
 * Use actual store for integration tests, mock for unit tests
 */
describe("WithStore", () => {
  // Unit test - mock store
  it("calls store action on interaction", () => {
    const mockSetExample = vi.fn();
    const store = {
      setExampleInInput: mockSetExample,
    };

    render(
      <BrainstormMessage blocks={blocks} onExampleClick={(text) => store.setExampleInInput(text)} />
    );

    fireEvent.click(screen.getByText("Example 1"));
    expect(mockSetExample).toHaveBeenCalledWith("Example 1");
  });

  // Integration test - use prop callback directly
  it("calls callback when example clicked", async () => {
    const user = userEvent.setup();
    const handleExampleClick = vi.fn();
    render(<BrainstormMessage blocks={blocks} onExampleClick={handleExampleClick} />);

    await user.click(screen.getByText("Example 1"));

    expect(handleExampleClick).toHaveBeenCalledWith("Example 1");
  });
});

/**
 * PATTERN: Testing Conditional Rendering
 */
describe("ConditionalRendering", () => {
  it("renders loading state", () => {
    render(<Component isLoading={true} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("renders content when loaded", () => {
    render(<Component isLoading={false} content="Hello" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders error state", () => {
    render(<Component error="Failed to load" />);
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });
});

/**
 * PATTERN: Testing Lists
 */
describe("Lists", () => {
  it("renders all items", () => {
    const items = ["Item 1", "Item 2", "Item 3"];
    render(<List items={items} />);

    items.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });

  it("renders empty state when no items", () => {
    render(<List items={[]} />);
    expect(screen.getByText("No items")).toBeInTheDocument();
  });

  it("handles item click", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<List items={["Item 1"]} onItemClick={handleClick} />);

    await user.click(screen.getByText("Item 1"));
    expect(handleClick).toHaveBeenCalledWith("Item 1");
  });
});

/**
 * PATTERN: Testing Accessibility
 */
describe("Accessibility", () => {
  it("has proper heading hierarchy", () => {
    render(<Component />);
    const h1 = screen.getByRole("heading", { level: 1 });
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h1).toBeInTheDocument();
    expect(h2).toBeInTheDocument();
  });

  it("has accessible form labels", () => {
    render(<Form />);
    // Both methods work - query by label
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
  });

  it("has ARIA roles", () => {
    render(<MessageList messages={messages} />);
    expect(screen.getByRole("region")).toBeInTheDocument();
  });
});

/**
 * PATTERN: Testing Context/Hooks
 */
describe("WithContext", () => {
  it("provides context value to children", () => {
    const TestComponent = () => {
      const { value } = useMyContext();
      return <div>{value}</div>;
    };

    render(
      <MyProvider value="Hello">
        <TestComponent />
      </MyProvider>
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});

/**
 * PATTERN: Testing Error Boundaries
 */
describe("ErrorHandling", () => {
  it("catches and displays errors", () => {
    const ThrowError = () => {
      throw new Error("Test error");
    };

    // Suppress console.error for this test
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    console.error.mockRestore();
  });
});

/**
 * ANTI-PATTERNS TO AVOID
 */

// ❌ Don't test implementation details
const component = render(<MyComponent />);
expect(component.container.querySelector(".my-class")).toBeInTheDocument();

// ✅ Test user-visible behavior
expect(screen.getByText("Expected text")).toBeInTheDocument();

// ❌ Don't use shallow rendering or implementation-focused testing
wrapper.find(".button").simulate("click");

// ✅ Use user-focused queries and events
await user.click(screen.getByRole("button"));

// ❌ Don't test internal state directly
expect(component.state.isOpen).toBe(true);

// ✅ Test what user sees
expect(screen.getByText("Modal title")).toBeInTheDocument();

/**
 * COMMON ASSERTIONS
 */

// Element presence
expect(element).toBeInTheDocument();
expect(element).not.toBeInTheDocument();

// Visibility
expect(element).toBeVisible();
expect(element).not.toBeVisible();

// Disabled state
expect(button).toBeDisabled();
expect(button).not.toBeDisabled();

// Checked state
expect(checkbox).toBeChecked();
expect(checkbox).not.toBeChecked();

// Text content
expect(element).toHaveTextContent("Expected text");
expect(element).not.toHaveTextContent("Unexpected text");

// Class presence
expect(element).toHaveClass("active");
expect(element).not.toHaveClass("active");

// Value
expect(input).toHaveValue("user input");

// Attributes
expect(link).toHaveAttribute("href", "/path");

// Function calls
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith("arg");
expect(mockFn).toHaveBeenCalledTimes(1);

/**
 * RUNNING TESTS
 *
 * pnpm test                    - Run all tests
 * pnpm test --watch           - Watch mode
 * pnpm test:coverage          - Coverage report
 * pnpm test MyComponent        - Run specific test
 * pnpm test --ui              - Open UI dashboard
 */
