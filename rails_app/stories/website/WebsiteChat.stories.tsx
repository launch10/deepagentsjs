import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import WebsiteChat from "@components/website/sidebar/WebsiteChat";

const meta = {
  title: "Landing Page Builder/Sidebar/Chat",
  component: WebsiteChat,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    onSendMessage: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: "320px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WebsiteChat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
