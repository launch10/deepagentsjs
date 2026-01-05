import type { Meta, StoryObj } from "@storybook/react-vite";
import { WebsiteChatView } from "@components/website/sidebar/WebsiteChat";

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
      {
        id: "1",
        role: "assistant",
        content: "Your website is ready! Feel free to ask me for any changes.",
      },
    ],
  },
};

export const AssistantMessage: Story = {
  args: {
    messages: [
      {
        id: "1",
        role: "assistant",
        content: "Hello! I'm here to help you customize your landing page.",
      },
    ],
  },
};

export const UserMessage: Story = {
  args: {
    messages: [
      {
        id: "1",
        role: "user",
        content: "Can you change the background color?",
      },
    ],
  },
};

export const Conversation: Story = {
  args: {
    messages: [
      {
        id: "1",
        role: "assistant",
        content: "Your website is ready! Feel free to ask me for any changes.",
      },
      {
        id: "2",
        role: "user",
        content: "Can you make the hero section larger?",
      },
      {
        id: "3",
        role: "assistant",
        content: "I've increased the hero section height and made the headline text larger.",
      },
    ],
  },
};

export const LongConversation: Story = {
  args: {
    messages: [
      {
        id: "1",
        role: "assistant",
        content: "Your website is ready! Feel free to ask me for any changes.",
      },
      {
        id: "2",
        role: "user",
        content: "Change the color scheme to blue",
      },
      {
        id: "3",
        role: "assistant",
        content: "Done! I've updated the color scheme to use blue tones.",
      },
      {
        id: "4",
        role: "user",
        content: "Make the font bigger",
      },
      {
        id: "5",
        role: "assistant",
        content: "I've increased the font sizes throughout the page.",
      },
      {
        id: "6",
        role: "user",
        content: "Add a contact form",
      },
      {
        id: "7",
        role: "assistant",
        content: "I've added a contact form section at the bottom of the page.",
      },
    ],
  },
};
