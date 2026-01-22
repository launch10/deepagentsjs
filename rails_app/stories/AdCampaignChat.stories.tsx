import type { Meta, StoryObj } from "@storybook/react-vite";
import { mocked } from "storybook/test";
import AdsChat from "@components/ads/workflow-panel/AdsChat";
import { useAdsChat, useAdsSelector } from "@components/ads/hooks";
import type { LanggraphChat } from "langgraph-ai-sdk-react";

const sampleMessages = [
  {
    role: "assistant" as const,
    blocks: [
      { id: "1", type: "text", text: "Hello! How can I help you with your ad campaign today?" },
    ],
  },
  {
    role: "user" as const,
    blocks: [{ id: "2", type: "text", text: "I need help writing better headlines" }],
  },
  {
    role: "assistant" as const,
    blocks: [
      {
        id: "3",
        type: "text",
        text: "I'd be happy to help! Let me suggest some headline improvements.",
      },
    ],
  },
];

interface MockSnapshot {
  messages: typeof sampleMessages | (typeof sampleMessages)[number][];
  state: Record<string, unknown>;
  status: "ready" | "streaming" | "submitted" | "idle";
  isLoading: boolean;
  isLoadingHistory: boolean;
  threadId: string;
  actions: {
    sendMessage: () => void;
    updateState: () => void;
    stop: () => void;
    reload: () => void;
  };
  composer: {
    text: string;
    setText: () => void;
    attachments: unknown[];
    addFiles: () => void;
    addFileUrl: () => void;
    addImageUrl: () => void;
    addAttachment: () => void;
    removeAttachment: () => void;
    retryAttachment: () => void;
    clear: () => void;
    isReady: boolean;
    isUploading: boolean;
    isEmpty: boolean;
    hasErrors: boolean;
  };
}

const baseMockSnapshot: MockSnapshot = {
  messages: [],
  state: {},
  status: "ready",
  isLoading: false,
  isLoadingHistory: false,
  threadId: "storybook-thread",
  actions: {
    sendMessage: () => {},
    updateState: () => {},
    stop: () => {},
    reload: () => {},
  },
  composer: {
    text: "",
    setText: () => {},
    attachments: [],
    addFiles: () => {},
    addFileUrl: () => {},
    addImageUrl: () => {},
    addAttachment: () => {},
    removeAttachment: () => {},
    retryAttachment: () => {},
    clear: () => {},
    isReady: false,
    isUploading: false,
    isEmpty: true,
    hasErrors: false,
  },
};

// Create a mock chat instance
const mockChat = {
  getSnapshot: () => baseMockSnapshot,
  subscribe: () => () => {},
} as unknown as LanggraphChat<any, any>;

// Helper to create mock with specific snapshot
let currentMockSnapshot: MockSnapshot = baseMockSnapshot;

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
    currentMockSnapshot = { ...baseMockSnapshot, messages: sampleMessages };
    mocked(useAdsChat).mockReturnValue(mockChat);
    mocked(useAdsSelector).mockImplementation((selector) => {
      return selector(currentMockSnapshot as any);
    });
  },
};

export const Empty: Story = {
  beforeEach: () => {
    currentMockSnapshot = { ...baseMockSnapshot };
    mocked(useAdsChat).mockReturnValue(mockChat);
    mocked(useAdsSelector).mockImplementation((selector) => {
      return selector(currentMockSnapshot as any);
    });
  },
};

export const Loading: Story = {
  beforeEach: () => {
    currentMockSnapshot = { ...baseMockSnapshot, isLoading: true, status: "streaming" as const };
    mocked(useAdsChat).mockReturnValue(mockChat);
    mocked(useAdsSelector).mockImplementation((selector) => {
      return selector(currentMockSnapshot as any);
    });
  },
};

export const LoadingHistory: Story = {
  beforeEach: () => {
    currentMockSnapshot = { ...baseMockSnapshot, isLoadingHistory: true };
    mocked(useAdsChat).mockReturnValue(mockChat);
    mocked(useAdsSelector).mockImplementation((selector) => {
      return selector(currentMockSnapshot as any);
    });
  },
};

export const Streaming: Story = {
  beforeEach: () => {
    currentMockSnapshot = {
      ...baseMockSnapshot,
      messages: sampleMessages,
      isLoading: true,
      status: "streaming" as const,
    };
    mocked(useAdsChat).mockReturnValue(mockChat);
    mocked(useAdsSelector).mockImplementation((selector) => {
      return selector(currentMockSnapshot as any);
    });
  },
};

export const LongConversation: Story = {
  beforeEach: () => {
    currentMockSnapshot = {
      ...baseMockSnapshot,
      messages: [
        ...sampleMessages,
        {
          role: "user" as const,
          blocks: [{ id: "4", type: "text", text: "Can you make them more punchy?" }],
        },
        {
          role: "assistant" as const,
          blocks: [
            { id: "5", type: "text", text: "Absolutely! Here are some punchier versions..." },
          ],
        },
        {
          role: "user" as const,
          blocks: [{ id: "6", type: "text", text: "Perfect, let's go with the second one" }],
        },
        {
          role: "assistant" as const,
          blocks: [{ id: "7", type: "text", text: "Great choice! I've updated your headline." }],
        },
      ],
    };
    mocked(useAdsChat).mockReturnValue(mockChat);
    mocked(useAdsSelector).mockImplementation((selector) => {
      return selector(currentMockSnapshot as any);
    });
  },
};
