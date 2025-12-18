import type { Meta, StoryObj } from "@storybook/react-vite";

import InfoTooltip from "@components/ui/info-tooltip";

const meta = {
  title: "UI/Info Tooltip",
  component: InfoTooltip,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof InfoTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    text: "Use a clear, searchable name so it's easy to find and report on later.",
  },
};
