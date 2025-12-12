import type { Meta, StoryObj } from "@storybook/react-vite";
import { HeaderProgressStepperView } from "@components/header/HeaderProgressStepper";

const meta = {
  title: "Header/Progress Stepper",
  component: HeaderProgressStepperView,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "600px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HeaderProgressStepperView>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultSteps = [
  { label: "Brainstorm" },
  { label: "Landing Page" },
  { label: "Ad Campaign" },
  { label: "Launch" },
];

export const AtBrainstorm: Story = {
  args: {
    steps: defaultSteps,
    currentStepIndex: 0,
  },
};

export const AtLandingPage: Story = {
  args: {
    steps: defaultSteps,
    currentStepIndex: 1,
  },
};

export const AtAdCampaign: Story = {
  args: {
    steps: defaultSteps,
    currentStepIndex: 2,
  },
};

export const AtLaunch: Story = {
  args: {
    steps: defaultSteps,
    currentStepIndex: 3,
  },
};
