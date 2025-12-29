import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "@components/chat/Input";

const meta = {
  title: "Chat/Input",
  component: Input.Root,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "500px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

// Basic textarea and submit
export const Default: Story = {
  render: () => (
    <Input.Root>
      <Input.Textarea placeholder="Type a message..." />
      <Input.SubmitButton />
    </Input.Root>
  ),
};

// Brainstorm style (simple)
export const BrainstormStyle: Story = {
  render: () => (
    <Input.Root>
      <Input.Textarea placeholder="What kind of business are you thinking about?" />
      <Input.SubmitButton />
    </Input.Root>
  ),
};

// Campaign style with file upload
export const CampaignStyle: Story = {
  render: () => (
    <Input.Root>
      <Input.FileUpload />
      <Input.Textarea placeholder="Ask for changes..." />
      <Input.SubmitButton />
    </Input.Root>
  ),
};

// With refresh button
export const WithRefreshButton: Story = {
  render: () => (
    <Input.Root>
      <Input.Textarea placeholder="Ask for changes..." />
      <Input.SubmitButton />
      <Input.RefreshButton />
    </Input.Root>
  ),
};

// Loading state
export const Loading: Story = {
  render: () => (
    <Input.Root>
      <Input.Textarea placeholder="Type a message..." />
      <Input.SubmitButton loading />
    </Input.Root>
  ),
};

// Disabled state
export const Disabled: Story = {
  render: () => (
    <Input.Root>
      <Input.Textarea placeholder="Type a message..." disabled />
      <Input.SubmitButton disabled />
    </Input.Root>
  ),
};

// With value
export const WithValue: Story = {
  render: () => (
    <Input.Root>
      <Input.Textarea
        value="I want to build an app that helps people find local farmers markets"
        onChange={() => {}}
      />
      <Input.SubmitButton />
    </Input.Root>
  ),
};
