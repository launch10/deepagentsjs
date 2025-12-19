import type { Meta, StoryObj } from "@storybook/react-vite";

import AdCampaignStepNumber from "@components/ads/sidebar/workflow-buddy/AdCampaignStepNumber";

const meta = {
  title: "Ad Campaign/Components/Step/Number",
  component: AdCampaignStepNumber,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {},
} satisfies Meta<typeof AdCampaignStepNumber>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = {
  args: {
    step: 1,
  },
};

export const Active: Story = {
  args: {
    step: 1,
    isActive: true,
  },
};
