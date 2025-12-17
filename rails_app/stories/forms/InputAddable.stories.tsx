import type { Meta, StoryObj } from "@storybook/react-vite";

import InputAddable from "@components/forms/input-addable";

const meta = {
  title: "Forms/Addable Input",
  component: InputAddable,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    onChange: () => {},
    onKeyDown: () => {},
    isInvalid: false,
    handleAdd: () => {},
    placeholder: "Enter headline",
    value: "",
  },
  globals: {
    backgrounds: {
      default: "background",
    },
  },
} satisfies Meta<typeof InputAddable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithError: Story = {
  args: {},
};
