/**
 * Generates a WebContainer snapshot with pre-installed dependencies.
 *
 * This snapshot is loaded by WebContainerManager instead of running npm install,
 * reducing startup time from ~60s to ~10s.
 *
 * Usage:
 *   pnpm run webcontainer:snapshot
 *
 * The output is written to public/webcontainer-snapshot.bin
 *
 * NOTE: For large dependency trees, you may need to increase Node's memory:
 *   NODE_OPTIONS="--max-old-space-size=8192" pnpm run webcontainer:snapshot
 *
 * Regenerate this snapshot when:
 * - Template dependencies change
 * - Template config files change (vite, tailwind, etc.)
 */

/* eslint-disable no-console */

import { snapshot } from "@webcontainer/snapshot";
import {
  writeFileSync,
  existsSync,
  cpSync,
  rmSync,
  readFileSync,
  writeFileSync as write,
  mkdirSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { execSync } from "child_process";

const TEMPLATE_DIR = join(process.cwd(), "templates", "default");
const TEMP_DIR = join(process.cwd(), ".snapshot-temp");
const OUTPUT_PATH = join(process.cwd(), "public", "webcontainer-snapshot.bin");

/**
 * Build the snapshot package.json from the template.
 * Adds WASM overrides and modifies scripts for WebContainer.
 */
function buildSnapshotPackageJson(): Record<string, unknown> {
  const templatePkg = JSON.parse(readFileSync(join(TEMPLATE_DIR, "package.json"), "utf-8"));

  return {
    ...templatePkg,
    scripts: {
      // Use full path since .bin symlinks are removed from snapshot
      dev: "node node_modules/vite/bin/vite.js --port 3000 --host",
      build: "node node_modules/vite/bin/vite.js build",
    },
    // WASM overrides for WebContainer (can't run native binaries)
    overrides: {
      rollup: "npm:@rollup/wasm-node",
      esbuild: "npm:esbuild-wasm",
    },
  };
}

async function generateSnapshot() {
  console.log("Generating WebContainer snapshot...");
  console.log("Using template package.json from templates/default/");

  const start = Date.now();

  try {
    // Clean up any existing temp directory
    if (existsSync(TEMP_DIR)) {
      console.log("Cleaning up previous temp directory...");
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    // Create temp directory
    mkdirSync(TEMP_DIR, { recursive: true });
    mkdirSync(join(TEMP_DIR, "src"), { recursive: true });

    // Build and write package.json with WASM overrides
    const snapshotPkg = buildSnapshotPackageJson();
    write(join(TEMP_DIR, "package.json"), JSON.stringify(snapshotPkg, null, 2));
    console.log(`  Dependencies: ${Object.keys(snapshotPkg.dependencies || {}).length}`);
    console.log(`  DevDependencies: ${Object.keys(snapshotPkg.devDependencies || {}).length}`);

    // Copy config files from template (but use .js versions to avoid esbuild compilation)
    const configFiles = [
      "postcss.config.js",
      "tsconfig.json",
      "tsconfig.app.json",
      "tsconfig.node.json",
    ];
    for (const file of configFiles) {
      const srcPath = join(TEMPLATE_DIR, file);
      if (existsSync(srcPath)) {
        const content = readFileSync(srcPath, "utf-8");
        write(join(TEMP_DIR, file), content);
      }
    }

    // Write vite.config.js (NOT .ts) to avoid needing esbuild to compile config
    // WebContainer can't run native esbuild binary
    write(
      join(TEMP_DIR, "vite.config.js"),
      `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 3000,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
});`
    );

    // Write tailwind.config.js (NOT .ts)
    write(
      join(TEMP_DIR, "tailwind.config.js"),
      `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [require('tailwindcss-animate')],
};`
    );

    // Add minimal index.html
    write(
      join(TEMP_DIR, "index.html"),
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Landing Page</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`
    );

    // Add minimal main.tsx
    write(
      join(TEMP_DIR, "src", "main.tsx"),
      `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div>Loading...</div>
  </React.StrictMode>
);`
    );

    // Add Tailwind CSS
    write(
      join(TEMP_DIR, "src", "index.css"),
      `@tailwind base;
@tailwind components;
@tailwind utilities;`
    );

    // Install dependencies in temp directory using npm
    // NOTE: We use npm (not pnpm) because pnpm creates symlinks in node_modules,
    // which @webcontainer/snapshot cannot serialize
    console.log("Installing dependencies with npm...");
    execSync("npm install", {
      cwd: TEMP_DIR,
      stdio: "inherit",
    });

    // NOTE: We keep all native packages - WebContainer should handle swapping
    // esbuild → esbuild-wasm automatically per StackBlitz's documented approach
    // See: https://github.com/stackblitz/webcontainer-core/issues/8
    console.log("\nKeeping native packages (WebContainer handles WASM fallbacks)...");

    // Remove .bin directory which contains symlinks that can't be serialized
    const binDir = join(TEMP_DIR, "node_modules", ".bin");
    if (existsSync(binDir)) {
      console.log("Removing node_modules/.bin symlinks...");
      rmSync(binDir, { recursive: true, force: true });
    }

    // Aggressively trim node_modules to reduce snapshot size and memory usage
    console.log("Trimming node_modules to reduce snapshot size...");
    const nodeModulesDir = join(TEMP_DIR, "node_modules");

    // Get size before trimming
    const getSizeCmd = `du -sh "${nodeModulesDir}" 2>/dev/null || echo "unknown"`;
    const sizeBefore = execSync(getSizeCmd, { encoding: "utf-8" }).trim();
    console.log(`  Size before: ${sizeBefore}`);

    // Remove unnecessary files and directories
    const patternsToRemove = [
      // Documentation and metadata
      "README*",
      "readme*",
      "CHANGELOG*",
      "changelog*",
      "HISTORY*",
      "history*",
      "LICENSE*",
      "license*",
      "LICENCE*",
      "licence*",
      "NOTICE*",
      "AUTHORS*",
      "CONTRIBUTORS*",
      "SECURITY*",
      "FUNDING*",
      "*.md",
      "*.markdown",
      "*.txt",
      // Test directories
      "test",
      "tests",
      "__tests__",
      "spec",
      "specs",
      "__mocks__",
      // Documentation directories
      "docs",
      "doc",
      "documentation",
      "example",
      "examples",
      "demo",
      "demos",
      // TypeScript source (keep .d.ts, remove .ts source)
      "*.ts.map",
      "tsconfig*.json",
      // Build artifacts and config
      ".npmignore",
      ".gitignore",
      ".editorconfig",
      ".eslintrc*",
      ".prettierrc*",
      "*.tsbuildinfo",
      "Makefile",
      "Gruntfile.js",
      "Gulpfile.js",
      // Package manager files
      "yarn.lock",
      "pnpm-lock.yaml",
      "package-lock.json",
      "shrinkwrap.json",
    ];

    // Use find to remove files matching patterns (more efficient than walking in JS)
    for (const pattern of patternsToRemove) {
      try {
        // -type f for files, -type d for directories
        if (
          [
            "test",
            "tests",
            "__tests__",
            "spec",
            "specs",
            "__mocks__",
            "docs",
            "doc",
            "documentation",
            "example",
            "examples",
            "demo",
            "demos",
          ].includes(pattern)
        ) {
          execSync(
            `find "${nodeModulesDir}" -type d -name "${pattern}" -exec rm -rf {} + 2>/dev/null || true`,
            { stdio: "pipe" }
          );
        } else {
          execSync(
            `find "${nodeModulesDir}" -type f -name "${pattern}" -delete 2>/dev/null || true`,
            { stdio: "pipe" }
          );
        }
      } catch {
        // Ignore errors - some patterns may not match
      }
    }

    // Get size after trimming
    const sizeAfter = execSync(getSizeCmd, { encoding: "utf-8" }).trim();
    console.log(`  Size after: ${sizeAfter}`);

    // Generate the snapshot from the temp directory
    console.log("Generating snapshot binary...");

    // Memory tracking - log every 5 seconds
    const memoryInterval = setInterval(() => {
      const used = process.memoryUsage();
      console.log(
        `  Memory: heap=${(used.heapUsed / 1024 / 1024).toFixed(0)}MB, rss=${(used.rss / 1024 / 1024).toFixed(0)}MB`
      );
    }, 5000);

    // Count files being snapshotted
    const fileCount = execSync(`find "${TEMP_DIR}" -type f | wc -l`, { encoding: "utf-8" }).trim();
    console.log(`  Files to snapshot: ${fileCount}`);

    const snapshotBuffer = await snapshot(TEMP_DIR);
    clearInterval(memoryInterval);

    // Write snapshot to public directory
    writeFileSync(OUTPUT_PATH, snapshotBuffer);

    const sizeMB = (snapshotBuffer.byteLength / 1024 / 1024).toFixed(2);
    console.log(`\nSnapshot generated successfully!`);
    console.log(`  Time: ${((Date.now() - start) / 1000).toFixed(1)}s`);
    console.log(`  Output: ${OUTPUT_PATH}`);
    console.log(`  Size: ${sizeMB} MB`);

    // Clean up temp directory
    console.log("Cleaning up...");
    rmSync(TEMP_DIR, { recursive: true, force: true });

    console.log("\nDone! The snapshot is ready to use.");
    console.log("\nNote: This is a minimal snapshot with core dependencies.");
    console.log("Additional project dependencies will be installed by npm install.");
  } catch (error) {
    console.error("Failed to generate snapshot:", error);

    // Clean up on error
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    process.exit(1);
  }
}

generateSnapshot();
