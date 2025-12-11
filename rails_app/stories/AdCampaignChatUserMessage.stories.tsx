import type { Meta, StoryObj } from "@storybook/react-vite";

import AdCampaignChatUserMessage from "@components/ad-campaign/ad-campaign-chat/ad-campaign-chat-user-message";

const meta = {
  title: "Ad Campaign/Components/Chat/User Message",
  component: AdCampaignChatUserMessage,
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
} satisfies Meta<typeof AdCampaignChatUserMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    message: "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Neque nesciunt",
  },
};
