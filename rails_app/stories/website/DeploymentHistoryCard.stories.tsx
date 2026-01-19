import type { Meta, StoryObj } from "@storybook/react-vite";
import DeploymentHistoryCard from "@components/website/deployment-history/DeploymentHistoryCard";

const meta = {
  title: "Landing Page Builder/Deployment History/Card",
  component: DeploymentHistoryCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof DeploymentHistoryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SuccessNewLive: Story = {
  name: "Success - New & Live",
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

export const SuccessOnly: Story = {
  name: "Success",
  args: {
    deployment: {
      id: "2",
      status: "success",
      timestamp: "Nov 24, 3:12 PM",
      adGroupName: "Ad Group Name",
      url: "http://paw-portraits.com-v1",
    },
  },
};

export const Failed: Story = {
  name: "Failed",
  args: {
    deployment: {
      id: "3",
      status: "failed",
      timestamp: "Nov 23, 9:00 AM",
      errorMessage: "DNS configuration error. Please verify your domain settings",
    },
  },
};
