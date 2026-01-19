import type { Meta, StoryObj } from "@storybook/react-vite";
import DomainSetup from "@components/website/domain-setup/DomainSetup";

const meta = {
  title: "Landing Page Builder/Domain Setup",
  component: DomainSetup,
  tags: ["autodocs"],
} satisfies Meta<typeof DomainSetup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
