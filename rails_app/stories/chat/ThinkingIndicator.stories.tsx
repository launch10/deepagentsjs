import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThinkingIndicator } from "~/components/chat/ThinkingIndicator";

const meta = {
  title: "Chat/ThinkingIndicator",
  component: ThinkingIndicator,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "400px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ThinkingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default thinking state
export const Default: Story = {
  args: {
    text: "Thinking",
  },
};

// With stage information
export const WithStage: Story = {
  args: {
    text: "Working",
    stage: "Analyzing your business idea",
  },
};

// Bubble variant (for Campaign-style chat)
export const BubbleVariant: Story = {
  args: {
    text: "Processing",
    variant: "bubble",
  },
};

// Bubble with stage
export const BubbleWithStage: Story = {
  args: {
    text: "Updating",
    stage: "Applying color changes to header",
    variant: "bubble",
  },
};

// Custom text examples
export const CustomText: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <ThinkingIndicator text="Generating ideas" />
      <ThinkingIndicator text="Researching market" stage="Analyzing competitors" />
      <ThinkingIndicator text="Creating landing page" stage="Building hero section" />
      <ThinkingIndicator text="Almost done" stage="Final touches" />
    </div>
  ),
};

// Comparison: default vs bubble
export const VariantComparison: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-neutral-500 mb-2">Default (Brainstorm style):</p>
        <ThinkingIndicator text="Thinking" stage="Generating business ideas" />
      </div>
      <div>
        <p className="text-sm text-neutral-500 mb-2">Bubble (Campaign style):</p>
        <ThinkingIndicator text="Processing" stage="Updating landing page" variant="bubble" />
      </div>
    </div>
  ),
};
