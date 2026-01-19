import { ImproveCopyView } from "@components/quick-actions/improve-copy/ImproveCopy";
import { QuickActionsView } from "@components/website/sidebar/quick-actions/QuickActions";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

const defaultCopyOptions = [
  { id: "professional", label: "Make tone more professional" },
  { id: "friendly", label: "Make tone more friendly" },
  { id: "shorter", label: "Make copy shorter" },
];

const meta = {
  title: "Quick Actions/Quick Actions",
  component: QuickActionsView,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    onActionClick: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: "320px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QuickActionsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activeAction: null,
    settingsContent: null,
  },
};

// Note: ColorsActive and ImagesActive stories removed because ColorPaletteSection
// and ProjectImagesSection are now wired to API hooks and require full app context.
// Use the full QuickActions component for testing those flows.

export const CopyActive: Story = {
  args: {
    activeAction: "copy",
    settingsContent: <ImproveCopyView options={defaultCopyOptions} onOptionSelect={fn()} />,
  },
};
