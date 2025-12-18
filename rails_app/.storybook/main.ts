import type { StorybookConfig } from "@storybook/react-vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-styling-webpack"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (config) => {
    // Remove vite-plugin-ruby which sets HMR to Rails' port 3036
    config.plugins = config.plugins?.filter((plugin) => {
      const name = Array.isArray(plugin) ? plugin[0]?.name : (plugin as any)?.name;
      return name !== "vite-plugin-ruby";
    });

    // Reset HMR to use Storybook's default (same port as server)
    config.server = {
      ...config.server,
      hmr: true,
    };

    // Mock @inertiajs/react for Storybook
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        "@inertiajs/react": path.resolve(__dirname, "mocks/inertia.ts"),
      },
    };

    config.plugins = [...(config.plugins ?? []), tsconfigPaths({ projects: ["./tsconfig.json"] })];

    return config;
  },
};
export default config;
