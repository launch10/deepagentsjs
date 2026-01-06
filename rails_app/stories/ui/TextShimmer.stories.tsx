import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextShimmer } from "@components/ui/text-shimmer";

const meta = {
  title: "UI/Text Shimmer",
  component: TextShimmer,
  tags: ["autodocs"],
  args: {
    children: "Lorem ipsum dolor sit amet.",
  },
  argTypes: {
    duration: {
      control: { type: "range", min: 0.5, max: 5, step: 0.5 },
    },
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof TextShimmer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Colored: Story = {
  args: {
    children: "Lorem ipsum dolor sit amet.",
    color: "var(--color-primary-400)",
    shimmerColor: "var(--color-primary-100)",
  },
};

export const SlowShimmer: Story = {
  args: {
    children: "Slow shimmer effect",
    duration: 4,
  },
};

export const FastShimmer: Story = {
  args: {
    children: "Fast shimmer effect",
    duration: 1,
  },
};

export const LargeText: Story = {
  args: {
    children: "Large Shimmering Text",
    className: "text-2xl font-bold",
  },
};
