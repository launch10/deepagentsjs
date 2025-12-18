import type { Meta, StoryObj } from "@storybook/react-vite";
import ReviewForm from "@components/ads/Forms/ReviewForm/ReviewForm";

const meta = {
  title: "Ad Campaign/Review Form",
  component: ReviewForm,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {},
  decorators: [
    (Story) => (
      <div style={{ padding: "2rem" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReviewForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
