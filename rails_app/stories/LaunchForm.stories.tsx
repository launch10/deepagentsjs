import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LaunchForm from "@components/ads/forms/launch-form/LaunchForm";

const meta = {
  title: "Ad Campaign/Launch Form",
  component: LaunchForm,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {},
  decorators: [
    (Story) => {
      return (
        <QueryClientProvider client={new QueryClient()}>
          <div style={{ padding: "2rem" }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof LaunchForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
