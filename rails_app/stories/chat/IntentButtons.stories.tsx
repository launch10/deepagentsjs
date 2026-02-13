import type { Meta, StoryObj } from "@storybook/react-vite";
import { IntentButtons } from "@components/shared/chat/IntentButtons";

const meta: Meta = {
  title: "Chat/IntentButtons",
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
    <IntentButtons.Root>
      <IntentButtons.Button variant="primary">Show Landing Page</IntentButtons.Button>
    </IntentButtons.Root>
  ),
};

// Primary with secondary options
export const PrimaryWithSecondary: Story = {
  render: () => (
    <IntentButtons.Root>
      <IntentButtons.Button variant="primary">Show Landing Page</IntentButtons.Button>
      <IntentButtons.Button>Continue Brainstorming</IntentButtons.Button>
    </IntentButtons.Root>
  ),
};

// Multiple options
export const MultipleOptions: Story = {
  render: () => (
    <IntentButtons.Root>
      <IntentButtons.Button variant="primary">Show Landing Page</IntentButtons.Button>
      <IntentButtons.Button>Continue Brainstorming</IntentButtons.Button>
      <IntentButtons.Button>Edit Response</IntentButtons.Button>
      <IntentButtons.Button>Start Over</IntentButtons.Button>
    </IntentButtons.Root>
  ),
};

// Campaign style actions
export const CampaignActions: Story = {
  render: () => (
    <IntentButtons.Root>
      <IntentButtons.Button variant="primary">Apply Changes</IntentButtons.Button>
      <IntentButtons.Button>Undo</IntentButtons.Button>
      <IntentButtons.Button>Regenerate</IntentButtons.Button>
    </IntentButtons.Root>
  ),
};

// Disabled state
export const WithDisabled: Story = {
  render: () => (
    <IntentButtons.Root>
      <IntentButtons.Button variant="primary">Show Landing Page</IntentButtons.Button>
      <IntentButtons.Button disabled>Continue (Processing...)</IntentButtons.Button>
    </IntentButtons.Root>
  ),
};

// All secondary buttons
export const AllSecondary: Story = {
  render: () => (
    <IntentButtons.Root>
      <IntentButtons.Button>Option A</IntentButtons.Button>
      <IntentButtons.Button>Option B</IntentButtons.Button>
      <IntentButtons.Button>Option C</IntentButtons.Button>
    </IntentButtons.Root>
  ),
};
