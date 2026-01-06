import Header from "@components/shared/header/Header";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorkflowProvider } from "@context/WorkflowProvider";

const meta = {
  title: "Header",
  component: Header,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <WorkflowProvider>
        <Story />
      </WorkflowProvider>
    ),
  ],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

// Note: In storybook, the workflow state is derived from URL.
// To test different states, use Storybook's URL parameters or
// navigate to different URLs in the stories.

export const Default: Story = {};

export const BrainstormStep: Story = {
  parameters: {
    // URL-as-truth: state is derived from URL
    // In Storybook, you can use router mocking or URL parameters
  },
};

export const WebsiteStep: Story = {};

export const CampaignStep: Story = {};

export const LaunchStep: Story = {};
