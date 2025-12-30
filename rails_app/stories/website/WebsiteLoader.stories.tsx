import type { Meta, StoryObj } from "@storybook/react-vite";
import WebsiteLoader from "@components/website/WebsiteLoader";

const defaultSteps = [
  { id: "analyze", label: "Analyzing your ideas" },
  { id: "branding", label: "Setting up branding & colors" },
  { id: "copy", label: "Writing compelling copy" },
  { id: "hero", label: "Designing hero section" },
  { id: "sections", label: "Adding additional sections" },
  { id: "images", label: "Selecting the perfect images" },
];

const meta = {
  title: "Landing Page Builder/Builder Loader",
  component: WebsiteLoader,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    steps: defaultSteps,
  },
} satisfies Meta<typeof WebsiteLoader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    currentStep: 0,
  },
};

export const Analyzing: Story = {
  args: {
    currentStep: 0,
  },
};

export const Branding: Story = {
  args: {
    currentStep: 1,
  },
};

export const Copy: Story = {
  args: {
    currentStep: 2,
  },
};

export const Hero: Story = {
  args: {
    currentStep: 3,
  },
};

export const Sections: Story = {
  args: {
    currentStep: 4,
  },
};

export const Images: Story = {
  args: {
    currentStep: 5,
  },
};

export const Complete: Story = {
  args: {
    currentStep: 6,
  },
};

export const CustomTitle: Story = {
  args: {
    title: "Generating your content",
    currentStep: 2,
  },
};
