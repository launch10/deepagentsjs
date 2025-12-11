import type { Meta, StoryObj } from "@storybook/react-vite";

import AdCampaignPreview from "@components/ad-campaign/ad-campaign-preview";

const meta = {
  title: "Ad Campaign/Components/Ad Preview",
  component: AdCampaignPreview,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "900px" }}>
        <Story />
      </div>
    ),
  ],
  args: {},
} satisfies Meta<typeof AdCampaignPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    headline: "Paw Portraits - Portraits of your furry family members",
    url: "pawportraits.launch10.ai",
    details:
      "Celebrate your pet with creative, personality-filled portraits. Cozy studio or outdoor sessions—crafted with patience, treats, and love. Book now.",
  },
};

export const Loading: Story = {
  args: {
    headline: "",
    url: "",
    details: "",
  },
};
