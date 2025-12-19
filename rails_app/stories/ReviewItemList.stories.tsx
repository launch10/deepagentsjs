import type { Meta, StoryObj } from "@storybook/react-vite";
import { ReviewItem, ReviewItemList } from "~/components/ads/Forms/ReviewForm/ReviewItem";
import { formatDate } from "~/helpers/formatUtils";

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
  args: {
    children: (
      <ReviewItemList>
        <ReviewItem label="Daily Budget">$500</ReviewItem>
        <ReviewItem label="Campaign Type">Google Search</ReviewItem>
      </ReviewItemList>
    ),
  },
};

export const WithMultipleItems: Story = {
  args: {
    children: (
      <ReviewItemList>
        <ReviewItem label="Campaign Name">My Campaign</ReviewItem>
        <ReviewItem label="Campaign Type">Google Search</ReviewItem>
        <ReviewItem label="Daily Budget">$500</ReviewItem>
        <ReviewItem label="Status">Active</ReviewItem>
      </ReviewItemList>
    ),
  },
};

export const WithComplexContent: Story = {
  args: {
    children: (
      <ReviewItemList>
        <ReviewItem label="Ad Schedule">
          <div className="flex flex-col gap-1 items-end">
            <span>Mon, Wed, Fri</span>
            <span className="text-base-300">9:00 AM - 5:00 PM</span>
          </div>
        </ReviewItem>
      </ReviewItemList>
    ),
  },
};

export const TargetingAndBudget: Story = {
  args: {
    children: (
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
  },
};

export const CampaignSettings: Story = {
  args: {
    children: (
      <ReviewItemList>
        <ReviewItem label="Campaign Name" className="py-4">
          Campaign Name
        </ReviewItem>
        <ReviewItem label="Campaign Type" className="py-4">
          Google Search
        </ReviewItem>
        <ReviewItem label="Bidding Strategy" className="py-4">
          Manual CPC
        </ReviewItem>
        <ReviewItem label="Duration" className="py-4">
          {formatDate(new Date(), {
            formatOptions: { month: "2-digit", day: "2-digit", year: "numeric" },
            fallback: "Not set",
          })}{" "}
          -{" "}
          {formatDate(new Date(), {
            formatOptions: { month: "2-digit", day: "2-digit", year: "numeric" },
            fallback: "Not set",
          })}
        </ReviewItem>
      </ReviewItemList>
    ),
  },
};

export const CampaignSettingsWithNoEndDate: Story = {
  args: {
    children: (
      <ReviewItemList>
        <ReviewItem label="Campaign Name" className="py-4">
          Campaign Name
        </ReviewItem>
        <ReviewItem label="Campaign Type" className="py-4">
          Google Search
        </ReviewItem>
        <ReviewItem label="Bidding Strategy" className="py-4">
          Manual CPC
        </ReviewItem>
        <ReviewItem label="Duration" className="py-4">
          {formatDate(new Date(), {
            formatOptions: { month: "2-digit", day: "2-digit", year: "numeric" },
            fallback: "Not set",
          })}{" "}
          -{" "}
          {formatDate(undefined, {
            formatOptions: { month: "2-digit", day: "2-digit", year: "numeric" },
            fallback: "Not set",
          })}
        </ReviewItem>
      </ReviewItemList>
    ),
  },
};
