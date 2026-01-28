import type { Meta, StoryObj } from "@storybook/react-vite";
import { CreditWarningModal } from "@components/credits/CreditWarningModal";
import { useCreditStore } from "~/stores/creditStore";

function setCreditState(overrides: Partial<ReturnType<typeof useCreditStore.getState>>) {
  useCreditStore.setState({
    balance: null,
    planCredits: null,
    packCredits: null,
    planCreditsAllocated: null,
    periodEndsAt: null,
    isOutOfCredits: false,
    showOutOfCreditsModal: false,
    modalDismissedAt: null,
    showLowCreditModal: false,
    lowCreditWarningDismissedAt: null,
    ...overrides,
  });
}

const meta = {
  title: "Credits/CreditWarningModal",
  component: CreditWarningModal,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof CreditWarningModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Out-of-credits variant: 0 remaining, modal triggered */
export const Exhausted: Story = {
  decorators: [
    (Story) => {
      setCreditState({
        balance: 0,
        planCredits: 0,
        packCredits: 0,
        planCreditsAllocated: 500,
        periodEndsAt: "2026-01-31T00:00:00Z",
        isOutOfCredits: true,
        showOutOfCreditsModal: true,
      });
      return <Story />;
    },
  ],
};

/** Low-credits variant: 75 of 500 remaining (85% used) */
export const LowCredits: Story = {
  decorators: [
    (Story) => {
      setCreditState({
        balance: 75,
        planCredits: 75,
        packCredits: 0,
        planCreditsAllocated: 500,
        periodEndsAt: "2026-01-31T00:00:00Z",
        isOutOfCredits: false,
        showLowCreditModal: true,
      });
      return <Story />;
    },
  ],
};
