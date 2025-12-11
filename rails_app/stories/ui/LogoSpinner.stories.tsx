import LogoSpinner from "@components/ui/logo-spinner";

import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "UI/Spinner",
  component: LogoSpinner,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof LogoSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Logo: Story = {
  args: {},
};
