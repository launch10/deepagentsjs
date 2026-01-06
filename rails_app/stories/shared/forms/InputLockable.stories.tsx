import type { Meta, StoryObj } from "@storybook/react-vite";

import InputLockable from "@components/shared/forms/input-lockable";

const meta = {
  title: "Forms/Lockable Input",
  component: InputLockable,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    placeholder: "Headline Option",
    value: "Headline Option 1",
  },
  globals: {
    backgrounds: {
      default: "background",
    },
  },
} satisfies Meta<typeof InputLockable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isLocked: false,
  },
};

export const Locked: Story = {
  args: {
    isLocked: true,
  },
};

export const WithError: Story = {
  args: {
    isLocked: false,
    isInvalid: true,
  },
};
