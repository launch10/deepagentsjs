import type { Meta, StoryObj } from "@storybook/react-vite";
import { CommandButtons } from "~/components/chat/CommandButtons";

const meta: Meta = {
  title: "Chat/CommandButtons",
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
};

export default meta;
type Story = StoryObj;

// Single primary action
export const SinglePrimary: Story = {
  render: () => (
    <CommandButtons.Root>
      <CommandButtons.Button variant="primary">Show Landing Page</CommandButtons.Button>
    </CommandButtons.Root>
  ),
};

// Primary with secondary options
export const PrimaryWithSecondary: Story = {
  render: () => (
    <CommandButtons.Root>
      <CommandButtons.Button variant="primary">Show Landing Page</CommandButtons.Button>
      <CommandButtons.Button>Continue Brainstorming</CommandButtons.Button>
    </CommandButtons.Root>
  ),
};

// Multiple options
export const MultipleOptions: Story = {
  render: () => (
    <CommandButtons.Root>
      <CommandButtons.Button variant="primary">Show Landing Page</CommandButtons.Button>
      <CommandButtons.Button>Continue Brainstorming</CommandButtons.Button>
      <CommandButtons.Button>Edit Response</CommandButtons.Button>
      <CommandButtons.Button>Start Over</CommandButtons.Button>
    </CommandButtons.Root>
  ),
};

// Campaign style actions
export const CampaignActions: Story = {
  render: () => (
    <CommandButtons.Root>
      <CommandButtons.Button variant="primary">Apply Changes</CommandButtons.Button>
      <CommandButtons.Button>Undo</CommandButtons.Button>
      <CommandButtons.Button>Regenerate</CommandButtons.Button>
    </CommandButtons.Root>
  ),
};

// Disabled state
export const WithDisabled: Story = {
  render: () => (
    <CommandButtons.Root>
      <CommandButtons.Button variant="primary">Show Landing Page</CommandButtons.Button>
      <CommandButtons.Button disabled>Continue (Processing...)</CommandButtons.Button>
    </CommandButtons.Root>
  ),
};

// All secondary buttons
export const AllSecondary: Story = {
  render: () => (
    <CommandButtons.Root>
      <CommandButtons.Button>Option A</CommandButtons.Button>
      <CommandButtons.Button>Option B</CommandButtons.Button>
      <CommandButtons.Button>Option C</CommandButtons.Button>
    </CommandButtons.Root>
  ),
};
