import type { Meta, StoryObj } from "@storybook/react-vite";
import WebsiteChatInput from "@components/website/sidebar/chat/WebsiteChatInput";

const meta = {
  title: "Landing Page Builder/Sidebar/Chat/Input",
  component: WebsiteChatInput,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {},
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

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
