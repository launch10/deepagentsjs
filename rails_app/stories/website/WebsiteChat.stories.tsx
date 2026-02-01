import type { Meta, StoryObj } from "@storybook/react-vite";
import WebsiteChat from "@components/website/sidebar/WebsiteChat";

const meta = {
  title: "Landing Page Builder/Sidebar/Chat",
  component: WebsiteChat,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {},
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

export const Locked: Story = {
  args: {
    locked: true,
  },
};
