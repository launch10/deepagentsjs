import type { Meta, StoryObj } from "@storybook/react-vite";

import AdCampaignChat from "@components/ad-campaign/ad-campaign-chat/ad-campaign-chat";

const meta = {
  title: "Ad Campaign/Components/Chat/Default",
  component: AdCampaignChat,
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
} satisfies Meta<typeof AdCampaignChat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
