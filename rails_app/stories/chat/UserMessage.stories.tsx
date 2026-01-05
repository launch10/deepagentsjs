import type { Meta, StoryObj } from "@storybook/react-vite";
import { UserMessage } from "@components/shared/chat/UserMessage";

const meta = {
  title: "Chat/UserMessage",
  component: UserMessage,
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
} satisfies Meta<typeof UserMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Short: Story = {
  args: {
    children: "Hello, world!",
  },
};

export const Medium: Story = {
  args: {
    children:
      "I'm building a SaaS product that helps small businesses manage their customer relationships more effectively.",
  },
};

export const Long: Story = {
  args: {
    children:
      "My business idea is a subscription-based platform that combines CRM functionality with AI-powered customer insights. We help small and medium businesses understand their customers better, predict churn, and automate follow-up communications. The target market is businesses with 10-100 employees who currently use spreadsheets or basic tools to manage customer relationships.",
  },
};

export const WithLineBreaks: Story = {
  args: {
    children:
      "First paragraph explaining the main idea.\n\nSecond paragraph with more details.\n\nThird paragraph with the conclusion.",
  },
};
