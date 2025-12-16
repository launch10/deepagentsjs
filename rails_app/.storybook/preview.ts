import type { Preview } from "@storybook/react-vite";
import { sb } from "storybook/test";
import "../app/assets/tailwind/application.css";

sb.mock(import("../app/javascript/frontend/hooks/useAdsChat.ts"), { spy: true });

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
