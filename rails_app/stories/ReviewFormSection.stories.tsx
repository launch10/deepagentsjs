import type { Meta, StoryObj } from "@storybook/react-vite";
import ReviewFormSection from "@components/ads/Forms/ReviewForm/ReviewFormSection";
import { CursorArrowRippleIcon } from "@heroicons/react/24/solid";

const meta = {
  title: "Ad Campaign/Review Form/Section",
  component: ReviewFormSection,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {},
} satisfies Meta<typeof ReviewFormSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Ad Content & Highlights",
    children: (
      <div>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Tempora deserunt earum, molestiae
        culpa ut quas, at fuga eaque modi ducimus rerum corrupti suscipit consequatur qui minus
        veniam numquam. Vero, tempora.
      </div>
    ),
  },
};

export const WithEditSection: Story = {
  args: {
    title: "Ad Content & Highlights",
    children: (
      <div>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Tempora deserunt earum, molestiae
        culpa ut quas, at fuga eaque modi ducimus rerum corrupti suscipit consequatur qui minus
        veniam numquam. Vero, tempora.
      </div>
    ),
    showEditSection: true,
    onEditSection: () => {},
  },
};

export const WithIcon: Story = {
  args: {
    title: "Ad Content & Highlights",
    icon: <CursorArrowRippleIcon className="size-4" />,
    children: (
      <div>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Tempora deserunt earum, molestiae
        culpa ut quas, at fuga eaque modi ducimus rerum corrupti suscipit consequatur qui minus
        veniam numquam. Vero, tempora.
      </div>
    ),
  },
};

export const WithEditSectionAndIcon: Story = {
  args: {
    title: "Ad Content & Highlights",
    icon: <CursorArrowRippleIcon className="size-4" />,
    showEditSection: true,
    onEditSection: () => {},
    children: (
      <div>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Tempora deserunt earum, molestiae
        culpa ut quas, at fuga eaque modi ducimus rerum corrupti suscipit consequatur qui minus
        veniam numquam. Vero, tempora.
      </div>
    ),
  },
};
