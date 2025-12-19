import type { Meta, StoryObj } from "@storybook/react-vite";
import { mocked } from "storybook/test";
import AdsChat from "@components/ads/sidebar/AdsChat";
import { useAdsChat } from "@hooks/useAdsChat";

const sampleMessages = [
  {
    role: "assistant" as const,
    blocks: [{ id: "1", type: "text", text: "Hello! How can I help you with your ad campaign today?" }],
  },
  {
    role: "user" as const,
    blocks: [{ id: "2", type: "text", text: "I need help writing better headlines" }],
  },
  {
    role: "assistant" as const,
    blocks: [{ id: "3", type: "text", text: "I'd be happy to help! Let me suggest some headline improvements." }],
  },
];

const baseMockSnapshot = {
  messages: [],
  state: {},
  status: "ready" as const,
  isLoading: false,
  isLoadingHistory: false,
  threadId: "storybook-thread",
  sendMessage: () => {},
  updateState: () => {},
  setState: () => {},
  stop: () => {},
};

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
  beforeEach: () => {
    mocked(useAdsChat).mockImplementation((selector) => {
      const snapshot = { ...baseMockSnapshot, messages: sampleMessages };
      return selector ? selector(snapshot as any) : snapshot;
    });
  },
};

export const Empty: Story = {
  beforeEach: () => {
    mocked(useAdsChat).mockImplementation((selector) => {
      const snapshot = { ...baseMockSnapshot };
      return selector ? selector(snapshot as any) : snapshot;
    });
  },
};

export const Loading: Story = {
  beforeEach: () => {
    mocked(useAdsChat).mockImplementation((selector) => {
      const snapshot = { ...baseMockSnapshot, isLoading: true, status: "streaming" as const };
      return selector ? selector(snapshot as any) : snapshot;
    });
  },
};

export const LoadingHistory: Story = {
  beforeEach: () => {
    mocked(useAdsChat).mockImplementation((selector) => {
      const snapshot = { ...baseMockSnapshot, isLoadingHistory: true };
      return selector ? selector(snapshot as any) : snapshot;
    });
  },
};

export const Streaming: Story = {
  beforeEach: () => {
    mocked(useAdsChat).mockImplementation((selector) => {
      const snapshot = { ...baseMockSnapshot, messages: sampleMessages, isLoading: true, status: "streaming" as const };
      return selector ? selector(snapshot as any) : snapshot;
    });
  },
};

export const LongConversation: Story = {
  beforeEach: () => {
    mocked(useAdsChat).mockImplementation((selector) => {
      const snapshot = {
        ...baseMockSnapshot,
        messages: [
          ...sampleMessages,
          { role: "user" as const, blocks: [{ id: "4", type: "text", text: "Can you make them more punchy?" }] },
          { role: "assistant" as const, blocks: [{ id: "5", type: "text", text: "Absolutely! Here are some punchier versions..." }] },
          { role: "user" as const, blocks: [{ id: "6", type: "text", text: "Perfect, let's go with the second one" }] },
          { role: "assistant" as const, blocks: [{ id: "7", type: "text", text: "Great choice! I've updated your headline." }] },
        ],
      };
      return selector ? selector(snapshot as any) : snapshot;
    });
  },
};
