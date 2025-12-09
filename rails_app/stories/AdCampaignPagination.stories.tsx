import type { Meta, StoryObj } from "@storybook/react-vite";

import AdCampaignPagination from "@components/ad-campaign/ad-campaign-pagination";

const meta = {
  title: "Ad Campaign/Components/Pagination",
  component: AdCampaignPagination,
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
  decorators: [
    (Story) => (
      <div style={{ padding: "2rem" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdCampaignPagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Enabled: Story = {
  args: {},
};

export const Disabled: Story = {
  args: {
    canContinue: false,
  },
};
