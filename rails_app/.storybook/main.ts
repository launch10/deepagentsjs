import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-styling-webpack"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (config) => {
    return mergeConfig(config, {
      resolve: {
        alias: {
          "@hooks/useAdsChat": resolve(__dirname, "../stories/mocks/hooks/useAdsChat.ts"),
        },
      },
      server: {
        port: 6006,
        strictPort: true,
        hmr: {
          protocol: "ws",
          host: "localhost",
          port: 6007,
          clientPort: 6007,
        },
      },
    });
  },
};
export default config;
