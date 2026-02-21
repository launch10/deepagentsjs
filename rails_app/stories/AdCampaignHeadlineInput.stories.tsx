import type { Meta, StoryObj } from "@storybook/react-vite";
import { z } from "zod";

import AdCampaignAssetInput from "@components/ads/forms/shared/AdCampaignAssetInput";

const meta = {
  title: "Ad Campaign/Components/Asset Input",
  component: AdCampaignAssetInput,
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
} satisfies Meta<typeof AdCampaignAssetInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Headlines",
    onAdd: () => {},
    currentCount: 0,
    maxCount: 15,
    placeholder: "Enter headline",
    maxLength: 30,
    validationSchema: z.string().min(1, "Cannot be empty").max(30, "Max 30 characters"),
    badgeText: "Select 3-15",
    onRefreshSuggestions: () => {},
  },
};
