import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReviewItem, ReviewItemList } from "@components/ads/forms/review-form/ReviewItem";

const meta = {
  title: "Ad Campaign/Review Form/Review Item",
  component: ReviewItem,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div style={{ padding: "2rem", maxWidth: "600px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReviewItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Daily Budget",
    children: "$500",
  },
};

export const WithComplexContent: Story = {
  args: {
    label: "Ad Schedule",
    children: (
      <div className="flex flex-col gap-1 items-end">
        <span>Mon, Wed, Fri</span>
        <span className="text-base-300">9:00 AM - 5:00 PM</span>
      </div>
    ),
  },
};
