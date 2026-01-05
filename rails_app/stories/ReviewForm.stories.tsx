import type { Meta, StoryObj } from "@storybook/react-vite";
import { mocked } from "storybook/test";
import ReviewForm from "@components/ads/forms/review-form/ReviewForm";
import { useAdsChatState } from "@components/ads/hooks";
import { useStageInit } from "@hooks/useStageInit";

// Mock data for useAdsChatState
const mockHeadlines = [
  { id: "1", text: "Transform Your Business Today", rejected: false, locked: false },
  { id: "2", text: "Get Started in Minutes", rejected: false, locked: false },
  { id: "3", text: "Join Thousands of Happy Customers", rejected: false, locked: false },
  { id: "4", text: "Premium Quality, Affordable Prices", rejected: true, locked: false },
];

const mockDescriptions = [
  {
    id: "1",
    text: "Discover the power of our innovative solution designed to help you succeed.",
    rejected: false,
    locked: false,
  },
  {
    id: "2",
    text: "Experience unmatched quality and service that sets us apart from the competition.",
    rejected: false,
    locked: false,
  },
  {
    id: "3",
    text: "Start your journey today with our easy-to-use platform and expert support.",
    rejected: false,
    locked: false,
  },
];

const mockCallouts = [
  { id: "1", text: "24/7 Customer Support", rejected: false, locked: false },
  { id: "2", text: "Free 30-Day Trial", rejected: false, locked: false },
  { id: "3", text: "Money-Back Guarantee", rejected: false, locked: false },
  { id: "4", text: "Award-Winning Service", rejected: false, locked: false },
];

const mockStructuredSnippets = {
  category: "Services",
  details: [
    { id: "1", text: "Consulting", rejected: false, locked: false },
    { id: "2", text: "Implementation", rejected: false, locked: false },
    { id: "3", text: "Training", rejected: false, locked: false },
    { id: "4", text: "Support", rejected: false, locked: false },
  ],
};

const mockKeywords = [
  { id: "1", text: "business solutions", rejected: false, locked: false },
  { id: "2", text: "enterprise software", rejected: false, locked: false },
  { id: "3", text: "cloud services", rejected: false, locked: false },
  { id: "4", text: "digital transformation", rejected: false, locked: false },
  { id: "5", text: "productivity tools", rejected: false, locked: false },
];

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
  beforeEach: () => {
    // Mock useStageInit
    mocked(useStageInit).mockImplementation(() => {});

    // Mock useAdsChatState to return different values based on the key
    mocked(useAdsChatState).mockImplementation(((key: string) => {
      if (key === "headlines") {
        return mockHeadlines;
      }
      if (key === "descriptions") {
        return mockDescriptions;
      }
      if (key === "callouts") {
        return mockCallouts;
      }
      if (key === "structuredSnippets") {
        return mockStructuredSnippets;
      }
      if (key === "keywords") {
        return mockKeywords;
      }
      return undefined;
    }) as any);
  },
} satisfies Meta<typeof ReviewForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
