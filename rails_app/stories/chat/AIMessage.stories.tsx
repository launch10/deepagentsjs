import type { Meta, StoryObj } from "@storybook/react-vite";
import { AIMessage } from "@components/shared/chat/AIMessage";
import { ThinkingIndicator } from "@components/shared/chat/ThinkingIndicator";
import { useAdsChat } from "@components/ads/hooks";
import { Chat } from "@components/shared/chat/Chat";

const meta: Meta<typeof AIMessage.Content> = {
  title: "Chat/AIMessage",
  component: AIMessage.Content,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "400px", width: "100%" }}>
        <Chat.Root chat={useAdsChat()}>
          <Story />
        </Chat.Root>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AIMessage.Content>;

export const Active: Story = {
  args: {
    children:
      "Hello! I'm here to help you brainstorm your next big idea. What kind of business or product are you thinking about?",
    state: "active",
  },
};

export const Inactive: Story = {
  args: {
    children: "This is a previous message that's no longer the focus.",
    state: "inactive",
  },
};

export const WithMarkdown: Story = {
  args: {
    children: `Here are some **key points** to consider:

1. Who is your target audience?
2. What problem are you solving?
3. Why is your solution unique?

*Let's explore each of these together.*`,
    state: "active",
  },
};

// Render-only stories need explicit typing
type RenderStory = StoryObj;

// Bubble wrapper story
export const WithBubble: RenderStory = {
  render: () => (
    <AIMessage.Bubble>
      <AIMessage.Content>
        This message has a bubble wrapper, like in the Campaign chat.
      </AIMessage.Content>
    </AIMessage.Bubble>
  ),
};

export const WithoutBubble: RenderStory = {
  render: () => (
    <AIMessage.Content>This message has no bubble, like in the Brainstorm chat.</AIMessage.Content>
  ),
};

// Root wrapper story
export const WithRoot: RenderStory = {
  render: () => (
    <AIMessage.Root>
      <AIMessage.Content>
        This message is wrapped in AIMessage.Root for consistent spacing.
      </AIMessage.Content>
    </AIMessage.Root>
  ),
};

// Loading story - use ThinkingIndicator
export const Loading: RenderStory = {
  render: () => <ThinkingIndicator text="Thinking" />,
};
