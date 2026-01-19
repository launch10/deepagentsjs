import type { Meta, StoryObj } from "@storybook/react-vite";
import { WebsiteChatView } from "@components/website/sidebar/WebsiteChat";
import type { AnyMessageWithBlocks } from "langgraph-ai-sdk-types";

/**
 * Helper to create a message with blocks for Storybook.
 * The actual messages from Langgraph use this format.
 */
function createMessage(
  id: string,
  role: "assistant" | "user",
  content: string
): AnyMessageWithBlocks {
  return {
    id,
    role,
    blocks: [{ type: "text", text: content }],
  } as AnyMessageWithBlocks;
}

const meta = {
  title: "Landing Page Builder/Sidebar/Chat/Messages",
  component: WebsiteChatView,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "280px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WebsiteChatView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    messages: [
      createMessage(
        "1",
        "assistant",
        "Your website is ready! Feel free to ask me for any changes."
      ),
    ],
  },
};

export const AssistantMessage: Story = {
  args: {
    messages: [
      createMessage("1", "assistant", "Hello! I'm here to help you customize your landing page."),
    ],
  },
};

export const UserMessage: Story = {
  args: {
    messages: [createMessage("1", "user", "Can you change the background color?")],
  },
};

export const Conversation: Story = {
  args: {
    messages: [
      createMessage(
        "1",
        "assistant",
        "Your website is ready! Feel free to ask me for any changes."
      ),
      createMessage("2", "user", "Can you make the hero section larger?"),
      createMessage(
        "3",
        "assistant",
        "I've increased the hero section height and made the headline text larger."
      ),
    ],
  },
};

export const LongConversation: Story = {
  args: {
    messages: [
      createMessage(
        "1",
        "assistant",
        "Your website is ready! Feel free to ask me for any changes."
      ),
      createMessage("2", "user", "Change the color scheme to blue"),
      createMessage("3", "assistant", "Done! I've updated the color scheme to use blue tones."),
      createMessage("4", "user", "Make the font bigger"),
      createMessage("5", "assistant", "I've increased the font sizes throughout the page."),
      createMessage("6", "user", "Add a contact form"),
      createMessage(
        "7",
        "assistant",
        "I've added a contact form section at the bottom of the page."
      ),
    ],
  },
};

export const StreamingMessage: Story = {
  args: {
    messages: [
      createMessage(
        "1",
        "assistant",
        "Your website is ready! Feel free to ask me for any changes."
      ),
      createMessage("2", "user", "Make it more colorful"),
      { id: "3", role: "assistant", blocks: [] } as AnyMessageWithBlocks,
    ],
    isStreaming: true,
  },
};
