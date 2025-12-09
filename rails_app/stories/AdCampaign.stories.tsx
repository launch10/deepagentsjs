import type { Meta, StoryObj } from "@storybook/react-vite";

import Campaign from "@pages/Campaign";

const meta = {
  title: "Ad Campaign/Page/Default",
  component: Campaign,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: "fullscreen",
  },
  args: {},
  globals: {
    backgrounds: { value: "background" },
  },
} satisfies Meta<typeof Campaign>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
