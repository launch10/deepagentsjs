import type { Meta, StoryObj } from "@storybook/react-vite";

import AdCampaignChatBotMessage from "@components/ad-campaign/ad-campaign-chat/ad-campaign-chat-bot-message";

const meta = {
  title: "Ad Campaign/Components/Chat/Bot Message",
  component: AdCampaignChatBotMessage,
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
} satisfies Meta<typeof AdCampaignChatBotMessage>;

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
