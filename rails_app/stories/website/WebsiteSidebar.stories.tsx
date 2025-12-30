import type { Meta, StoryObj } from "@storybook/react-vite";
import { WebsiteSidebarView } from "@components/website/sidebar/WebsiteSidebar";

const meta = {
  title: "Landing Page Builder/Sidebar",
  component: WebsiteSidebarView,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "320px", padding: "2rem" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WebsiteSidebarView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isLoading: false,
    currentStep: 0,
  },
};
