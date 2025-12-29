import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageList } from "@components/chat/MessageList";
import { UserMessage } from "@components/chat/UserMessage";
import { AIMessage } from "@components/chat/AIMessage";

const meta = {
  title: "Chat/MessageList",
  component: MessageList.Root,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "500px", height: "400px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MessageList.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

// Empty state
export const Empty: Story = {
  render: () => (
    <MessageList.Root className="h-full">
      <div className="flex items-center justify-center h-full text-neutral-400">
        No messages yet
      </div>
    </MessageList.Root>
  ),
};

// Brainstorm style conversation (no bubbles)
export const BrainstormStyle: Story = {
  render: () => (
    <MessageList.Root className="h-full p-4">
      <AIMessage.Content>
        Hi! I'm here to help you brainstorm your next big idea. What kind of business are you
        thinking about?
      </AIMessage.Content>
      <UserMessage>I want to build an app for finding local farmers markets</UserMessage>
      <AIMessage.Content>
        That's a great idea! Local farmers markets are growing in popularity. Let me ask you a few
        questions to help refine this concept. **Who is your target audience?** - Health-conscious
        consumers? - Busy professionals looking for convenience? - Families wanting fresh produce?
      </AIMessage.Content>
      <UserMessage>
        Mainly busy professionals who want to eat healthy but don't have time to search for markets
      </UserMessage>
    </MessageList.Root>
  ),
};

// Campaign style conversation (with bubbles)
export const CampaignStyle: Story = {
  render: () => (
    <MessageList.Root className="h-full p-4">
      <UserMessage>Make the header background blue</UserMessage>
      <AIMessage.Bubble>
        <AIMessage.Content>
          I've updated the header to have a blue background. The color I used is `#3B82F6` which
          provides good contrast with white text.
        </AIMessage.Content>
      </AIMessage.Bubble>
      <UserMessage>Can you also add a subtle gradient?</UserMessage>
      <AIMessage.Bubble>
        <AIMessage.Content>
          Done! I've added a gradient from `#3B82F6` to `#1D4ED8` going from left to right. It adds
          depth while keeping the professional look.
        </AIMessage.Content>
      </AIMessage.Bubble>
    </MessageList.Root>
  ),
};

// With loading indicator
export const WithLoading: Story = {
  render: () => (
    <MessageList.Root className="h-full p-4">
      <AIMessage.Content>What would you like to build today?</AIMessage.Content>
      <UserMessage>A subscription box service for coffee enthusiasts</UserMessage>
      <AIMessage.Loading />
    </MessageList.Root>
  ),
};

// Long conversation with scroll
export const LongConversation: Story = {
  render: () => (
    <MessageList.Root className="h-full p-4">
      <AIMessage.Content>Welcome! Let's brainstorm together.</AIMessage.Content>
      <UserMessage>I want to start a business</UserMessage>
      <AIMessage.Content>Great! What industry interests you?</AIMessage.Content>
      <UserMessage>Technology</UserMessage>
      <AIMessage.Content>Technology is a broad field. Can you narrow it down?</AIMessage.Content>
      <UserMessage>AI and machine learning</UserMessage>
      <AIMessage.Content>
        AI/ML is exciting! Here are some directions: - B2B SaaS tools - Consumer applications -
        Developer tools - Industry-specific solutions
      </AIMessage.Content>
      <UserMessage>I'm thinking B2B SaaS</UserMessage>
      <AIMessage.Content>
        B2B SaaS has great recurring revenue potential. What problem would you solve?
      </AIMessage.Content>
      <UserMessage>Help companies automate customer support</UserMessage>
      <AIMessage.Content>
        Customer support automation is a proven market! Companies like Intercom and Zendesk have
        validated demand. What would make your solution unique?
      </AIMessage.Content>
    </MessageList.Root>
  ),
};
