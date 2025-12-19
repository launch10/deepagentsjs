import type { Preview } from "@storybook/react-vite";
import { sb } from "storybook/test";
import "../app/assets/tailwind/application.css";

sb.mock(import("../app/javascript/frontend/hooks/useAdsChat.ts"), { spy: true });
sb.mock(import("../app/javascript/frontend/hooks/useStageInit.ts"), { spy: true });

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  initialGlobals: {
    backgrounds: {
      values: [{ name: "background", value: "#fafaf9" }],
    },
  },
};

export default preview;
