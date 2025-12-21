import type { Meta, StoryObj } from "@storybook/react-vite";
import ReviewFormFieldGroup from "@components/ads/forms/review-form/ReviewFormFieldGroup";

const meta = {
  title: "Ad Campaign/Review Form/Field Group",
  component: ReviewFormFieldGroup,
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
} satisfies Meta<typeof ReviewFormFieldGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Selected Headlines",
    items: [
      { id: "1", text: "Headline 1" },
      { id: "2", text: "Headline 2" },
      { id: "3", text: "Headline 3" },
    ],
  },
};

export const WithPagination: Story = {
  args: {
    title: "Selected Headlines",
    items: [
      { id: "1", text: "Headline 1" },
      { id: "2", text: "Headline 2" },
      { id: "3", text: "Headline 3" },
      { id: "4", text: "Headline 4" },
      { id: "5", text: "Headline 5" },
      { id: "6", text: "Headline 6" },
    ],
    showPagination: true,
  },
};
