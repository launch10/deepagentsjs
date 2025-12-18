import type { Meta, StoryObj } from "@storybook/react-vite";

import InputDatePicker from "@components/ui/input-date-picker";

const meta = {
  title: "Forms/Date Picker Input",
  component: InputDatePicker,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    value: "",
    placeholder: "MM/DD/YYYY",
    onChange: () => {},
  },
  globals: {
    backgrounds: {
      default: "background",
    },
  },
} satisfies Meta<typeof InputDatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithValue: Story = {
  args: {
    value: new Date().toISOString(),
  },
};

export const WithError: Story = {
  args: {
    value: "Invalid date",
    "aria-invalid": true,
  },
};
