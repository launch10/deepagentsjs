import type { Meta, StoryObj } from "@storybook/react-vite";
import DeploymentHistory from "@components/website/deployment-history/DeploymentHistory";

const meta = {
  title: "Landing Page Builder/Deployment History/Deployment History",
  component: DeploymentHistory,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof DeploymentHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MultipleDeployments: Story = {
  args: {
    deployments: [
      {
        id: "1",
        status: "success",
        isNew: true,
        isLive: true,
        timestamp: "Nov 25, 5:07 PM",
        adGroupName: "Holiday Campaign",
        url: "http://paw-portraits.com",
      },
      {
        id: "2",
        status: "success",
        isNew: false,
        isLive: false,
        timestamp: "Nov 24, 2:30 PM",
        adGroupName: "Launch Campaign",
        url: "http://paw-portraits.com",
      },
      {
        id: "3",
        status: "failed",
        isNew: false,
        isLive: false,
        timestamp: "Nov 23, 10:15 AM",
        url: "http://paw-portraits.com",
        errorMessage: "DNS configuration error. Please verify your domain settings",
      },
    ],
  },
};
