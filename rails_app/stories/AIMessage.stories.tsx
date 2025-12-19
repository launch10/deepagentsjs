import type { Meta, StoryObj } from "@storybook/react-vite";

import AIMessage from "@components/ads/sidebar/ads-chat/AIMessage";

const meta = {
  title: "Ad Campaign/Components/Chat/Bot Message",
  component: AIMessage,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {},
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "288px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AIMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: {
    state: "active",
    message: "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Neque nesciunt",
  },
};

export const Inactive: Story = {
  args: {
    state: "inactive",
    message: "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Neque nesciunt",
  },
};
