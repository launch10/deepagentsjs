import type { Preview } from "@storybook/react-vite";
import "../app/assets/tailwind/application.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
