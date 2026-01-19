import type { Meta, StoryObj } from "@storybook/react-vite";
import SetupSubDomain from "@components/website/domain-setup/SetupSubDomain";

const meta = {
  title: "Landing Page Builder/Domain Setup/Tabs/Subdomain",
  component: SetupSubDomain,
  tags: ["autodocs"],
} satisfies Meta<typeof SetupSubDomain>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Subdomain: Story = {
  args: {},
};
