import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReviewItem, ReviewItemList } from "~/components/ads/Forms/ReviewForm/ReviewItem";

const meta = {
  title: "Ad Campaign/Review Form/Review Item List",
  component: ReviewItemList,
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
} satisfies Meta<typeof ReviewItemList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <ReviewItemList>
      <ReviewItem label="Daily Budget">$500</ReviewItem>
      <ReviewItem label="Campaign Type">Google Search</ReviewItem>
    </ReviewItemList>
  ),
};

export const WithMultipleItems: Story = {
  render: () => (
    <ReviewItemList>
      <ReviewItem label="Campaign Name">My Campaign</ReviewItem>
      <ReviewItem label="Campaign Type">Google Search</ReviewItem>
      <ReviewItem label="Daily Budget">$500</ReviewItem>
      <ReviewItem label="Status">Active</ReviewItem>
    </ReviewItemList>
  ),
};

export const WithComplexContent: Story = {
  render: () => (
    <ReviewItemList>
      <ReviewItem label="Ad Schedule">
        <div className="flex flex-col gap-1 items-end">
          <span>Mon, Wed, Fri</span>
          <span className="text-base-300">9:00 AM - 5:00 PM</span>
        </div>
      </ReviewItem>
      <ReviewItem label="Daily Budget">$500</ReviewItem>
      <ReviewItem label="Total Spend">
        <div className="flex flex-col gap-1 items-end">
          <span className="font-semibold">$2,500</span>
          <span className="text-base-300">This month</span>
        </div>
      </ReviewItem>
    </ReviewItemList>
  ),
};

export const TargetingAndBudget: Story = {
  render: () => (
    <ReviewItemList>
      <ReviewItem label="Ad Schedule">
        <div className="flex flex-col gap-1 items-end">
          <span>Mon, Wed, Fri</span>
          <span className="text-base-300">9:00 AM - 5:00 PM</span>
        </div>
      </ReviewItem>
      <ReviewItem label="Daily Budget">$500</ReviewItem>
    </ReviewItemList>
  ),
};

export const CampaignSettings: Story = {
  render: () => (
    <ReviewItemList>
      <ReviewItem label="Campaign Name" className="py-4">
        Campaign Name
      </ReviewItem>
      <ReviewItem label="Campaign Type" className="py-4">
        Google Search
      </ReviewItem>
    </ReviewItemList>
  ),
};
