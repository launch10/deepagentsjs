import type { Meta, StoryObj } from "@storybook/react-vite";

import AdsChat from "@components/ads/Sidebar/AdsChat";

const meta = {
  title: "Ad Campaign/Components/Chat/Default",
  component: AdsChat,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {},
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "288px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdsChat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
