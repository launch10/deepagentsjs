import type { Meta, StoryObj } from "@storybook/react-vite";
import { TopicBadge } from "@components/chat/TopicBadge";

const meta = {
  title: "Chat/TopicBadge",
  component: TopicBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof TopicBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// Active topic (currently being discussed)
export const Active: Story = {
  args: {
    topic: "Problem",
    variant: "active",
  },
};

// Completed topic
export const Completed: Story = {
  args: {
    topic: "Target Audience",
    variant: "completed",
  },
};

// Pending topic (not yet discussed)
export const Pending: Story = {
  args: {
    topic: "Unique Value Proposition",
    variant: "pending",
  },
};

// All brainstorm topics
export const AllTopics: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <TopicBadge topic="Problem" variant="completed" />
      <TopicBadge topic="Target Audience" variant="completed" />
      <TopicBadge topic="Solution" variant="active" />
      <TopicBadge topic="Unique Value Proposition" variant="pending" />
      <TopicBadge topic="Headlines" variant="pending" />
      <TopicBadge topic="Social Proof" variant="pending" />
    </div>
  ),
};

// Topic progression example
export const TopicProgression: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-neutral-500 mb-2">Beginning of conversation:</p>
        <div className="flex flex-wrap gap-2">
          <TopicBadge topic="Problem" variant="active" />
          <TopicBadge topic="Target Audience" variant="pending" />
          <TopicBadge topic="Solution" variant="pending" />
        </div>
      </div>
      <div>
        <p className="text-sm text-neutral-500 mb-2">Mid conversation:</p>
        <div className="flex flex-wrap gap-2">
          <TopicBadge topic="Problem" variant="completed" />
          <TopicBadge topic="Target Audience" variant="completed" />
          <TopicBadge topic="Solution" variant="active" />
        </div>
      </div>
      <div>
        <p className="text-sm text-neutral-500 mb-2">End of conversation:</p>
        <div className="flex flex-wrap gap-2">
          <TopicBadge topic="Problem" variant="completed" />
          <TopicBadge topic="Target Audience" variant="completed" />
          <TopicBadge topic="Solution" variant="completed" />
        </div>
      </div>
    </div>
  ),
};
