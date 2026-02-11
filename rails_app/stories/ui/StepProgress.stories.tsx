import type { Meta, StoryObj } from "@storybook/react-vite";
import { StepProgress } from "~/components/ui/step-progress";

const defaultSteps = [
  { id: "analyze", label: "Analyzing your ideas" },
  { id: "branding", label: "Setting up branding & colors" },
  { id: "copy", label: "Writing compelling copy" },
  { id: "hero", label: "Designing hero section" },
  { id: "sections", label: "Adding additional sections" },
  { id: "images", label: "Selecting the perfect images" },
];

const meta = {
  title: "UI/Step Progress",
  component: StepProgress,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    title: "Building your landing page",
    steps: defaultSteps,
  },
} satisfies Meta<typeof StepProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { currentStep: 0 },
};

export const Midway: Story = {
  args: { currentStep: 3 },
};

export const WithSubtitle: Story = {
  args: {
    currentStep: 2,
    subtitle: "Writing compelling copy",
  },
};

export const NearComplete: Story = {
  args: { currentStep: 5 },
};

export const Complete: Story = {
  args: { currentStep: 6 },
};
