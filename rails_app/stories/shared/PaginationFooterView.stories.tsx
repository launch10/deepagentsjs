import type { Meta, StoryObj } from "@storybook/react-vite";
import { mocked } from "storybook/test";

import { PaginationFooterView } from "@components/shared/pagination-footer";
import { useAdsChatState } from "@components/ads/hooks";

const meta = {
  title: "Shared/PaginationFooter",
  component: PaginationFooterView,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    onBack: () => {},
    onPrimary: () => {},
    onSecondary: () => {},
    canGoBack: true,
    canGoForward: true,
    isPending: false,
    showPrimaryAction: false,
  },
  globals: {
    backgrounds: {
      default: "background",
    },
  },
  beforeEach: () => {
    mocked(useAdsChatState).mockImplementation(((key: string) => {
      if (key === "campaignId") {
        return "mock-campaign-id";
      }
      return undefined;
    }) as any);
  },
  decorators: [
    (Story) => (
      <div style={{ padding: "2rem" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PaginationFooterView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithReturnToReview: Story = {
  args: {
    showPrimaryAction: true,
  },
};

export const Disabled: Story = {
  args: {
    canGoBack: false,
    canGoForward: false,
    showPrimaryAction: true,
  },
  beforeEach: () => {
    mocked(useAdsChatState).mockImplementation(((key: string) => {
      if (key === "campaignId") {
        return undefined;
      }
      return undefined;
    }) as any);
  },
};

export const Pending: Story = {
  args: {
    isPending: true,
  },
};

export const Review: Story = {
  args: {
    variant: "review",
  },
};

export const ReviewPending: Story = {
  args: {
    variant: "review",
    isPending: true,
  },
};

export const Launched: Story = {
  args: {
    variant: "launched",
  },
};

export const LaunchedPending: Story = {
  args: {
    variant: "launched",
    isPending: true,
  },
};
