import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ColorPalettesView } from "@components/quick-actions/color-palettes/ColorPalettes";
import { Card } from "@components/ui/card";

const mockPalettes = [
  ["#43597f", "#9fc2d5", "#e6f9fa", "#e07655", "#2a3240"],
  ["#2f4554", "#4e9991", "#e5c577", "#e9a46b", "#d77558"],
  ["#de5470", "#f8d476", "#62d4a4", "#3f8ab0", "#183b4a"],
];

const meta = {
  title: "Landing Page Builder/Sidebar/Color Palettes",
  component: ColorPalettesView,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    palettes: mockPalettes,
    currentPage: 1,
    totalPages: 2,
    onPrevPage: fn(),
    onNextPage: fn(),
    onAddCustom: fn(),
    onPaletteSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: "320px", padding: "2rem" }}>
        <Card className="rounded-2xl">
          <Story />
        </Card>
      </div>
    ),
  ],
} satisfies Meta<typeof ColorPalettesView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FirstPage: Story = {
  args: {
    currentPage: 1,
    totalPages: 3,
  },
};

export const MiddlePage: Story = {
  args: {
    currentPage: 2,
    totalPages: 3,
  },
};

export const LastPage: Story = {
  args: {
    currentPage: 3,
    totalPages: 3,
  },
};

export const SinglePage: Story = {
  args: {
    currentPage: 1,
    totalPages: 1,
  },
};

export const WarmPalettes: Story = {
  args: {
    palettes: [
      ["#ff6b6b", "#feca57", "#ff9ff3", "#f368e0", "#ff9f43"],
      ["#ee5253", "#ff6b6b", "#ffa502", "#ff6348", "#ff4757"],
      ["#eb3b5a", "#fa8231", "#fed330", "#fc5c65", "#fd9644"],
    ],
    currentPage: 1,
    totalPages: 1,
  },
};

export const CoolPalettes: Story = {
  args: {
    palettes: [
      ["#0abde3", "#10ac84", "#00d2d3", "#1dd1a1", "#54a0ff"],
      ["#2e86de", "#341f97", "#5f27cd", "#48dbfb", "#0abde3"],
      ["#6c5ce7", "#a29bfe", "#74b9ff", "#0984e3", "#00cec9"],
    ],
    currentPage: 1,
    totalPages: 1,
  },
};
