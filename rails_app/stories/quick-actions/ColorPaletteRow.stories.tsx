import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import ColorPaletteRow from "@components/quick-actions/color-palettes/ColorPaletteRow";

const meta = {
  title: "Quick Actions/Color Palette Row",
  component: ColorPaletteRow,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    onClick: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: "280px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ColorPaletteRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    colors: ["#43597f", "#9fc2d5", "#e6f9fa", "#e07655", "#2a3240"],
  },
};

export const WarmColors: Story = {
  args: {
    colors: ["#de5470", "#f8d476", "#62d4a4", "#3f8ab0", "#183b4a"],
  },
};

export const CoolColors: Story = {
  args: {
    colors: ["#2f4554", "#4e9991", "#e5c577", "#e9a46b", "#d77558"],
  },
};

export const ThreeColors: Story = {
  args: {
    colors: ["#ff6b6b", "#feca57", "#48dbfb"],
  },
};

export const SixColors: Story = {
  args: {
    colors: ["#ee5253", "#ff6b6b", "#ffa502", "#1dd1a1", "#48dbfb", "#5f27cd"],
  },
};

export const Monochrome: Story = {
  args: {
    colors: ["#000000", "#333333", "#666666", "#999999", "#cccccc"],
  },
};
