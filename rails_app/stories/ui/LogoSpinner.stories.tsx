import type { Meta, StoryObj } from "@storybook/react-vite";

import { fn } from "storybook/test";

import LogoSpinner from "@components/ui/logo-spinner.tsx";

const meta = {
  title: "UI/Spinner/Logo",
  component: LogoSpinner,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: "fullscreen",
  },
  args: {
    onLogin: fn(),
    onLogout: fn(),
    onCreateAccount: fn(),
  },
} satisfies Meta<typeof LogoSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Logo: Story = {
  args: {},
};
