# Brainstorm UI Component Patterns

Quick reference for building components following Launch10 conventions.

---

## Compound Components

Use compound components instead of boolean props:

```tsx
// RIGHT - Compound pattern
<AIMessage.Bubble>
  <AIMessage.Content state="active">Hello</AIMessage.Content>
</AIMessage.Bubble>

// WRONG - Boolean props
<AIMessage hasBubble isActive content="Hello" />
```

### Standard Sub-component Names

| Name | Purpose |
|------|---------|
| `Root` | Container/wrapper |
| `Content` | Main content |
| `Bubble` | Visual wrapper |
| `Loading` | Loading state |
| `Empty` | Empty state |
| `Error` | Error state |

### File Structure

```
components/chat/
└── AIMessage/
    ├── index.tsx         # Compound component
    └── __tests__/
        └── AIMessage.test.tsx
```

---

## Testing Patterns

### Query Priority

`getByRole` > `getByLabelText` > `getByText` > `getByTestId`

### Test Structure

```typescript
describe("AIMessage", () => {
  // Isolation tests
  describe("Content", () => {
    it("renders content", () => {
      render(<AIMessage.Content>Hello</AIMessage.Content>);
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });
  });

  // Composition tests
  describe("composition", () => {
    it("renders with bubble", () => {
      render(
        <AIMessage.Bubble>
          <AIMessage.Content>Hello</AIMessage.Content>
        </AIMessage.Bubble>
      );
      expect(screen.getByText("Hello").closest("div")?.parentElement)
        .toHaveClass("bg-base-200");
    });
  });
});
```

---

## Store Patterns

### Separation of Concerns

```typescript
type BrainstormStore = {
  routing: RoutingState;      // JWT, paths (from Inertia, doesn't change)
  brainstorm: {
    project?: ProjectMetadata; // From Rails (persisted)
    memories: Memories;        // From graph (ephemeral)
  };
  ui: UIState;                // Local only
};
```

### Hydration Pattern

```typescript
// In BrainstormHydrator.tsx
useEffect(() => {
  if (!hasHydratedRef.current) {
    hydrateFromInertia(props);  // One-time hydration
    hasHydratedRef.current = true;
  }
}, [props, hydrateFromInertia]);
```

### Graph Updates

```typescript
updateFromGraph: (graphState: Partial<GraphState>) => {
  set((state) => {
    // Only merge provided fields
    if (graphState.topic !== undefined) {
      state.brainstorm.topic = graphState.topic;
    }
  });
};
```

---

## Message Block Rendering

```typescript
function BlockRenderer({ block }: { block: MessageBlock<Data> }) {
  switch (block.type) {
    case "text":
      return <AIMessage.Content>{block.text}</AIMessage.Content>;
    case "structured":
      return <StructuredRenderer data={block.data} />;
    case "tool_call":
      return <ToolStatus block={block} />;
    default:
      return null;
  }
}
```

---

## Storybook Stories

```typescript
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AIMessage } from "@components/chat/AIMessage";

const meta = {
  title: "Chat/AIMessage",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [(Story) => (
    <div style={{ maxWidth: "600px" }}><Story /></div>
  )],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  render: () => <AIMessage.Content state="active">Hello</AIMessage.Content>,
};

export const Inactive: Story = {
  render: () => <AIMessage.Content state="inactive">Old message</AIMessage.Content>,
};
```

---

## PR Checklist

Before submitting:

- [ ] Uses compound pattern (max 2 boolean props)
- [ ] Test file exists with isolation + composition tests
- [ ] Storybook story with all variants
- [ ] Types separated (graph state vs Rails data)
- [ ] No direct store mutations in components
- [ ] Uses SDK hooks for messages
- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm storybook:build` succeeds
