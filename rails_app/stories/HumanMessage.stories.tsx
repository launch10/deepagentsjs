import type { Meta, StoryObj } from "@storybook/react-vite";
import HumanMessage from "@components/ads/sidebar/ads-chat/HumanMessage";

const meta = {
  title: "Ad Campaign/Components/Chat/User Message",
  component: HumanMessage,
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
} satisfies Meta<typeof HumanMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    message: "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Neque nesciunt",
  },
};
