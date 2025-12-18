import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mocked } from "storybook/test";
import KeywordsForm from "@components/ads/Forms/KeywordsForm/KeywordsForm";
import { useStageInit } from "@hooks/useStageInit";

const meta = {
  title: "Ad Campaign/Keywords Form",
  component: KeywordsForm,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {},
  globals: {
    backgrounds: {
      default: "background",
    },
  },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient();
      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ padding: "2rem" }}>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  beforeEach: () => {
    mocked(useStageInit).mockImplementation(() => {});
  },
} satisfies Meta<typeof KeywordsForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
