import type { Meta, StoryObj } from "@storybook/react-vite";
import CreateFlowTodoList from "~/components/website/sidebar/create-flow/CreateFlowTodoList";

const meta = {
  title: "Landing Page Builder/Create Flow/Todo List",
  component: CreateFlowTodoList,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "320px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CreateFlowTodoList>;

export default meta;
type Story = StoryObj<typeof meta>;

// CreateFlowTodoList reads todos from the chat store.
// In isolation it renders the "Preparing..." fallback state.
export const Default: Story = {};
