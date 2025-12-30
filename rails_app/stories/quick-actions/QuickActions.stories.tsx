import { ColorPalettesView } from "@components/quick-actions/color-palettes/ColorPalettes";
import { ImagesManagerView } from "@components/quick-actions/images-manager/ImagesManager";
import { ImproveCopyView } from "@components/quick-actions/improve-copy/ImproveCopy";
import { QuickActionsView } from "@components/website/sidebar/quick-actions/QuickActions";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

const defaultPalettes = [
  ["#43597f", "#9fc2d5", "#e6f9fa", "#e07655", "#2a3240"],
  ["#2f4554", "#4e9991", "#e5c577", "#e9a46b", "#d77558"],
  ["#de5470", "#f8d476", "#62d4a4", "#3f8ab0", "#183b4a"],
];

const defaultImages = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }];

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

export const ColorsActive: Story = {
  args: {
    activeAction: "colors",
    settingsContent: (
      <ColorPalettesView
        palettes={defaultPalettes}
        currentPage={1}
        totalPages={2}
        onPrevPage={fn()}
        onNextPage={fn()}
        onAddCustom={fn()}
        onPaletteSelect={fn()}
      />
    ),
  },
};

export const ImagesActive: Story = {
  args: {
    activeAction: "images",
    settingsContent: (
      <ImagesManagerView
        images={defaultImages}
        selectedIds={["1", "2", "3"]}
        onImageSelect={fn()}
        onImageRemove={fn()}
        onUpload={fn()}
      />
    ),
  },
};

export const CopyActive: Story = {
  args: {
    activeAction: "copy",
    settingsContent: <ImproveCopyView options={defaultCopyOptions} onOptionSelect={fn()} />,
  },
};
