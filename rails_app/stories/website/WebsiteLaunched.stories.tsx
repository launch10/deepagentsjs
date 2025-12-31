import type { Meta, StoryObj } from "@storybook/react-vite";
import WebsiteLaunched from "@components/website/WebsiteLaunched";

const meta = {
  title: "Landing Page Builder/Website Launched",
  component: WebsiteLaunched,
  tags: ["autodocs"],
} satisfies Meta<typeof WebsiteLaunched>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    domainUrl: "https://example.com",
  },
};
