import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import WebsiteChatInput from "@components/website/sidebar/chat/WebsiteChatInput";

const meta = {
  title: "Landing Page Builder/Sidebar/Chat/Input",
  component: WebsiteChatInput,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    onSubmit: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: "280px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WebsiteChatInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomPlaceholder: Story = {
  args: {
    placeholder: "What would you like to change?",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
