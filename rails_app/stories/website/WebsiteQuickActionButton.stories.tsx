import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import QuickActionButton from "@components/website/sidebar/quick-actions/QuickActionButton";
import { Palette, Image, FileText } from "lucide-react";

const meta = {
  title: "Landing Page Builder/Sidebar/Quick Actions",
  component: QuickActionButton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    onClick: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: "280px", padding: "1rem" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QuickActionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Change Colors",
    icon: Palette,
    iconColor: "text-accent-yellow-600",
    isActive: false,
  },
};

export const Active: Story = {
  args: {
    label: "Change Colors",
    icon: Palette,
    iconColor: "text-accent-yellow-600",
    isActive: true,
  },
};

export const SwapImages: Story = {
  args: {
    label: "Swap Images",
    icon: Image,
    iconColor: "text-accent-green-500",
    isActive: false,
  },
};

export const ImproveCopy: Story = {
  args: {
    label: "Improve Copy",
    icon: FileText,
    iconColor: "text-primary-400",
    isActive: false,
  },
};
