import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ImagesManagerView } from "@components/quick-actions/images-manager/ImagesManager";

const defaultImages = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }];

const imagesWithSrc = [
  { id: "1", src: "https://picsum.photos/seed/1/200", alt: "Sample image 1" },
  { id: "2", src: "https://picsum.photos/seed/2/200", alt: "Sample image 2" },
  { id: "3", src: "https://picsum.photos/seed/3/200", alt: "Sample image 3" },
  { id: "4" },
  { id: "5" },
];

const meta = {
  title: "Quick Actions/Images Manager",
  component: ImagesManagerView,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    onImageSelect: fn(),
    onImageRemove: fn(),
    onUpload: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: "320px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ImagesManagerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    images: defaultImages,
    selectedIds: [],
  },
};

export const WithSelectedImages: Story = {
  args: {
    images: defaultImages,
    selectedIds: ["1", "2", "3"],
  },
};

export const WithActualImages: Story = {
  args: {
    images: imagesWithSrc,
    selectedIds: ["1", "2", "3"],
  },
};

export const NoImages: Story = {
  args: {
    images: [],
    selectedIds: [],
  },
};
