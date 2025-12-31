import type { Meta, StoryObj } from "@storybook/react-vite";
import WebsiteLaunch from "@components/website/WebsiteLaunch";

const meta = {
  title: "Landing Page Builder/Website Launch",
  component: WebsiteLaunch,
  tags: ["autodocs"],
  argTypes: {
    onLaunch: { action: "launch" },
    onCopyUrl: { action: "copy url" },
    onOpenUrl: { action: "open url" },
  },
} satisfies Meta<typeof WebsiteLaunch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    domainUrl: "https://example.com",
  },
};
