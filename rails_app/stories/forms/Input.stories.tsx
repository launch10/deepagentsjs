import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "@components/ui/input";

const meta = {
  title: "Forms/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    placeholder: "Placeholder",
  },
  globals: {
    backgrounds: {
      default: "background",
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithValue: Story = {
  args: {
    value: "Value",
  },
};

export const WithError: Story = {
  args: {
    value: "Value with error",
    "aria-invalid": true,
  },
};
