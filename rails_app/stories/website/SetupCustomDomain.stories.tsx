import type { Meta, StoryObj } from "@storybook/react-vite";
import SetupCustomDomain from "@components/website/domain-setup/SetupCustomDomain";

const meta = {
  title: "Landing Page Builder/Domain Setup/Tabs/Custom Domain",
  component: SetupCustomDomain,
  tags: ["autodocs"],
} satisfies Meta<typeof SetupCustomDomain>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CustomDomain: Story = {
  args: {},
};
