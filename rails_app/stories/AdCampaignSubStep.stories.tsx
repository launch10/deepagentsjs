import type { Meta, StoryObj } from "@storybook/react-vite";

import AdCampaignSubstep from "~/components/ads/Sidebar/WorkflowBuddy/AdCampaignSubstep";

const meta = {
  title: "Ad Campaign/Components/Step/Substep",
  component: AdCampaignSubstep,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {},
  decorators: [
    (Story) => (
      <ul className="list-none">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof AdCampaignSubstep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = {
  args: {
    subStep: {
      label: "Content",
      isSubStepActive: false,
    },
  },
};

export const Active: Story = {
  args: {
    subStep: {
      label: "Content",
      isSubStepActive: true,
    },
  },
};

export const Completed: Story = {
  args: {
    subStep: {
      label: "Content",
      isSubStepActive: false,
      isSubStepCompleted: true,
    },
  },
};
