import type { Meta, StoryObj } from "@storybook/react-vite";
import AdsChat from "@components/ads/Sidebar/AdsChat";
import { withMockAdsChat, mockAdsChatStates, sampleMessages } from "./decorators/withMockAdsChat";

const meta = {
  title: "Ad Campaign/Components/Chat",
  component: AdsChat,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "288px", width: "288px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdsChat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [withMockAdsChat(mockAdsChatStates.withMessages)],
};

export const Empty: Story = {
  decorators: [withMockAdsChat(mockAdsChatStates.empty)],
};

export const Loading: Story = {
  decorators: [withMockAdsChat(mockAdsChatStates.loading)],
};

export const LoadingHistory: Story = {
  decorators: [withMockAdsChat(mockAdsChatStates.loadingHistory)],
};

export const Streaming: Story = {
  decorators: [withMockAdsChat(mockAdsChatStates.streaming)],
};

export const LongConversation: Story = {
  decorators: [
    withMockAdsChat({
      messages: [
        ...sampleMessages,
        { role: "user", blocks: [{ id: "4", type: "text", text: "Can you make them more punchy?" }] },
        { role: "assistant", blocks: [{ id: "5", type: "text", text: "Absolutely! Here are some punchier versions..." }] },
        { role: "user", blocks: [{ id: "6", type: "text", text: "Perfect, let's go with the second one" }] },
        { role: "assistant", blocks: [{ id: "7", type: "text", text: "Great choice! I've updated your headline." }] },
      ],
    }),
  ],
};
