import type { Meta, StoryObj } from "@storybook/react-vite";
import LoaderSpinner from "@components/ui/loader-spinner";

const meta = {
  title: "UI/Spinner/Loader",
  component: LoaderSpinner,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof LoaderSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loader: Story = {
  args: {},
};
