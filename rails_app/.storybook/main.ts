import type { StorybookConfig } from "@storybook/react-vite";

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

    return config;
  },
};
export default config;
