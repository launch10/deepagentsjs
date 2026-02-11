import type { Meta, StoryObj } from "@storybook/react-vite";
import CreateFlowTodoItem from "~/components/website/sidebar/create-flow/CreateFlowTodoItem";
import {
  BugAntIcon,
  ChatBubbleBottomCenterTextIcon,
  ChartBarIcon,
} from "@heroicons/react/24/solid";

const meta = {
  title: "Landing Page Builder/Create Flow/Todo Item",
  component: CreateFlowTodoItem,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "258px" }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    status: {
      control: "select",
      options: ["completed", "in_progress", "pending"],
    },
  },
} satisfies Meta<typeof CreateFlowTodoItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Completed: Story = {
  args: {
    icon: BugAntIcon,
    label: "Checking for bugs",
    status: "completed",
  },
};

export const InProgress: Story = {
  args: {
    icon: ChatBubbleBottomCenterTextIcon,
    label: "Optimizing SEO",
    status: "in_progress",
  },
};

export const Pending: Story = {
  args: {
    icon: ChartBarIcon,
    label: "Connecting Analytics for Ad",
    status: "pending",
  },
};
