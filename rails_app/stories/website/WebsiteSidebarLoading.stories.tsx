import type { Meta, StoryObj } from "@storybook/react-vite";
import WebsiteSidebarLoading from "~/components/website/sidebar/loading/WebsiteSidebarLoading";

const meta = {
  title: "Landing Page Builder/Sidebar/Loading Pills",
  component: WebsiteSidebarLoading,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "320px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WebsiteSidebarLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

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

export const Polish: Story = {
  args: {
    currentStep: 6,
  },
};

export const Complete: Story = {
  args: {
    currentStep: 7,
  },
};
