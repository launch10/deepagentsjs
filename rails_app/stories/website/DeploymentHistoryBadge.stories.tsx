import type { Meta, StoryObj } from "@storybook/react-vite";
import DeploymentHistoryBadge from "@components/website/deployment-history/DeploymentHistoryBadge";

const meta = {
  title: "Landing Page Builder/Deployment History/Badge",
  component: DeploymentHistoryBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof DeploymentHistoryBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const New: Story = {
  args: {
    variant: "new",
  },
};

export const Live: Story = {
  args: {
    variant: "live",
  },
};

export const Success: Story = {
  args: {
    variant: "success",
  },
};

export const Failed: Story = {
  args: {
    variant: "failed",
  },
};

export const All: Story = {
  args: {
    variant: "new",
  },
  render: () => (
    <div className="flex flex-col gap-2">
      <DeploymentHistoryBadge variant="new" />
      <DeploymentHistoryBadge variant="live" />
      <DeploymentHistoryBadge variant="success" />
      <DeploymentHistoryBadge variant="failed" />
    </div>
  ),
};
