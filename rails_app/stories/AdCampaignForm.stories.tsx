import type { Meta, StoryObj } from "@storybook/react-vite";

import AdCampaignForm from "@components/ad-campaign/ad-campaign-form";

const meta = {
  title: "Ad Campaign/Components/Form",
  component: AdCampaignForm,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: "fullscreen",
  },
  args: {},
  globals: {
    backgrounds: {
      default: "background",
    },
  },
} satisfies Meta<typeof AdCampaignForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {
  args: {},
};
