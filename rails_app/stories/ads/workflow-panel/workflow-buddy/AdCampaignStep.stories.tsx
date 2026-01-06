import type { Meta, StoryObj } from "@storybook/react-vite";

import AdCampaignStep from "@components/ads/workflow-panel/workflow-buddy/AdCampaignStep";

const meta = {
  title: "Ad Campaign/Components/Step",
  component: AdCampaignStep,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {},
} satisfies Meta<typeof AdCampaignStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = {
  args: {
    step: 1,
    stepName: "Create",
    isActive: false,
    subSteps: [
      {
        label: "Content",
        isSubStepActive: true,
      },
      {
        label: "Highlights",
        isSubStepActive: false,
      },
    ],
  },
};

export const Active: Story = {
  args: {
    step: 1,
    stepName: "Create",
    isActive: true,
    subSteps: [
      {
        label: "Content",
        isSubStepActive: true,
      },
      {
        label: "Highlights",
        isSubStepActive: false,
      },
    ],
  },
};

export const Completed: Story = {
  args: {
    step: 1,
    stepName: "Create",
    isActive: true,
    subSteps: [
      {
        label: "Content",
        isSubStepActive: false,
        isSubStepCompleted: true,
      },
      {
        label: "Highlights",
        isSubStepActive: false,
        isSubStepCompleted: false,
      },
    ],
  },
};
