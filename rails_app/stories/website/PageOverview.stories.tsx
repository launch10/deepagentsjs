import type { Meta, StoryObj } from "@storybook/react-vite";
import PageOverview from "@components/website/page-overview/PageOverview";

const meta = {
  title: "Landing Page Builder/Page Overview",
  component: PageOverview,
  tags: ["autodocs"],
} satisfies Meta<typeof PageOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
