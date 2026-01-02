import type { Meta, StoryObj } from "@storybook/react-vite";
import DeploymentHistoryFirst from "@components/website/deployment-history/DeploymentHistoryFirst";

const meta = {
  title: "Landing Page Builder/Deployment History/Deployment History",
  component: DeploymentHistoryFirst,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof DeploymentHistoryFirst>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstDeployment: Story = {
  args: {
    deployment: {
      id: "1",
      status: "success",
      isNew: true,
      isLive: true,
      timestamp: "Nov 25, 5:07 PM",
      adGroupName: "Ad Group Name",
      url: "http://paw-portraits.com",
    },
  },
};
