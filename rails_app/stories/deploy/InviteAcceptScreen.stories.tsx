import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { InviteAcceptView } from "~/components/deploy/screens/InviteAcceptScreen";

const meta = {
  title: "Deploy/InviteAcceptScreen",
  component: InviteAcceptView,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    onResendInvite: fn(),
    onAccepted: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[948px] h-[660px] border border-neutral-300 bg-white rounded-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InviteAcceptView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    googleEmail: "example@email.com",
  },
};

export const NoEmail: Story = {
  args: {},
};
