import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./app/javascript/frontend/test/setup.ts"],
    include: ["app/javascript/frontend/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "**/*.test.*", "**/*.spec.*", "*.config.*"],
    },
  },
});
