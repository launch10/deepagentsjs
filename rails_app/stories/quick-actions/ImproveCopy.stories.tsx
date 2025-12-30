import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ImproveCopyView } from "@components/quick-actions/improve-copy/ImproveCopy";

const defaultOptions = [
  { id: "professional", label: "Make tone more professional" },
  { id: "friendly", label: "Make tone more friendly" },
  { id: "shorter", label: "Make copy shorter" },
];

const meta = {
  title: "Quick Actions/Improve Copy",
  component: ImproveCopyView,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    options: defaultOptions,
    onOptionSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: "320px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ImproveCopyView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomOptions: Story = {
  args: {
    options: [
      { id: "concise", label: "Make copy more concise" },
      { id: "detailed", label: "Add more details" },
      { id: "persuasive", label: "Make copy more persuasive" },
      { id: "casual", label: "Make tone more casual" },
    ],
  },
};

export const SingleOption: Story = {
  args: {
    options: [{ id: "professional", label: "Make tone more professional" }],
  },
};
