import type { Meta, StoryObj } from "@storybook/react-vite";

import AdCampaignHeadlineInput from "@components/ads/Forms/ContentForm/AdCampaignHeadlineInput";

const meta = {
  title: "Ad Campaign/Components/Headline Input",
  component: AdCampaignHeadlineInput,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {},
  globals: {
    backgrounds: {
      default: "background",
    },
  },
} satisfies Meta<typeof AdCampaignHeadlineInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onAdd: () => {},
    currentCount: 0,
    maxCount: 15,
    onRefreshSuggestions: () => {},
  },
};
