import type { Meta, StoryObj } from "@storybook/react-vite";
import { AIMessage } from "~/components/chat/AIMessage";
import { ThinkingIndicator } from "~/components/chat/ThinkingIndicator";

// Content stories
const contentMeta = {
  title: "Chat/AIMessage/Content",
  component: AIMessage.Content,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "400px", width: "100%" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AIMessage.Content>;

export default contentMeta;
type ContentStory = StoryObj<typeof contentMeta>;

export const Active: ContentStory = {
  args: {
    children:
      "Hello! I'm here to help you brainstorm your next big idea. What kind of business or product are you thinking about?",
    state: "active",
  },
};

export const Inactive: ContentStory = {
  args: {
    children: "This is a previous message that's no longer the focus.",
    state: "inactive",
  },
};

export const WithMarkdown: ContentStory = {
  args: {
    children: `Here are some **key points** to consider:

1. Who is your target audience?
2. What problem are you solving?
3. Why is your solution unique?

*Let's explore each of these together.*`,
    state: "active",
  },
};

// Bubble wrapper story
export const WithBubble: ContentStory = {
  render: () => (
    <AIMessage.Bubble>
      <AIMessage.Content>
        This message has a bubble wrapper, like in the Campaign chat.
      </AIMessage.Content>
    </AIMessage.Bubble>
  ),
};

export const WithoutBubble: ContentStory = {
  render: () => (
    <AIMessage.Content>This message has no bubble, like in the Brainstorm chat.</AIMessage.Content>
  ),
};

// Root wrapper story
export const WithRoot: ContentStory = {
  render: () => (
    <AIMessage.Root>
      <AIMessage.Content>
        This message is wrapped in AIMessage.Root for consistent spacing.
      </AIMessage.Content>
    </AIMessage.Root>
  ),
};

// Loading story - use ThinkingIndicator instead of deprecated AIMessage.Loading
export const Loading: ContentStory = {
  render: () => <ThinkingIndicator text="Thinking" />,
};
