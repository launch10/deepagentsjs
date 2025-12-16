import Header from "@components/Header/Header";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorkflowStepsProvider } from "@context/WorkflowStepsProvider";

const meta = {
  title: "Header",
  component: Header,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <WorkflowStepsProvider
        workflow={{ page: "ad_campaign", substep: "content" }}
        projectUUID="test-uuid"
      >
        <Story />
      </WorkflowStepsProvider>
    ),
  ],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BrainstormStep: Story = {
  decorators: [
    (Story) => (
      <WorkflowStepsProvider
        workflow={{ page: "brainstorm", substep: null }}
        projectUUID="test-uuid"
      >
        <Story />
      </WorkflowStepsProvider>
    ),
  ],
};

export const WebsiteStep: Story = {
  decorators: [
    (Story) => (
      <WorkflowStepsProvider
        workflow={{ page: "website", substep: null }}
        projectUUID="test-uuid"
      >
        <Story />
      </WorkflowStepsProvider>
    ),
  ],
};

export const CampaignStep: Story = {
  decorators: [
    (Story) => (
      <WorkflowStepsProvider
        workflow={{ page: "ad_campaign", substep: null }}
        projectUUID="test-uuid"
      >
        <Story />
      </WorkflowStepsProvider>
    ),
  ],
};

export const LaunchStep: Story = {
  decorators: [
    (Story) => (
      <WorkflowStepsProvider
        workflow={{ page: "launch", substep: null }}
        projectUUID="test-uuid"
      >
        <Story />
      </WorkflowStepsProvider>
    ),
  ],
};