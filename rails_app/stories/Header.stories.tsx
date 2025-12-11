import Header from "@components/header/header";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorkflowProgressProvider } from "~/contexts/workflow-progress-context";
import { workflow } from "@shared";

const meta = {
  title: "Header",
  component: Header,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <WorkflowProgressProvider steps={workflow.launch.steps}>
        <Story />
      </WorkflowProgressProvider>
    ),
  ],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    steps: [
      { label: "Brainstorm" },
      { label: "Landing Page" },
      { label: "Ad Campaign" },
      { label: "Launch" },
    ],
    currentStepIndex: 1,
  },
};
