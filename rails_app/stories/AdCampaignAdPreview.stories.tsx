import type { Meta, StoryObj } from "@storybook/react-vite";
import { mocked } from "storybook/test";
import AdPreview from "@components/ads/AdPreview";
import { useAdsChatState } from "@components/ads/hooks";

const meta = {
  title: "Ad Campaign/Components/Ad Preview",
  component: AdPreview,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "900px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () => {
    mocked(useAdsChatState).mockImplementation(((key: string) => {
      if (key === "headlines") {
        return [
          { text: "Paw Portraits", locked: false, rejected: false },
          { text: "Portraits of your furry family members", locked: false, rejected: false },
          { text: "Capture their personality", locked: false, rejected: false },
        ];
      }
      if (key === "descriptions") {
        return [
          {
            text: "Celebrate your pet with creative, personality-filled portraits. Cozy studio or outdoor sessions—crafted with patience, treats, and love. Book now.",
            locked: false,
            rejected: false,
          },
        ];
      }
      return undefined;
    }) as any);
  },
};

export const Loading: Story = {
  beforeEach: () => {
    mocked(useAdsChatState).mockReturnValue(undefined as any);
  },
};

export const PartialContent: Story = {
  beforeEach: () => {
    mocked(useAdsChatState).mockImplementation(((key: string) => {
      if (key === "headlines") {
        return [{ text: "Single Headline Only", locked: false, rejected: false }];
      }
      return undefined;
    }) as any);
  },
};
