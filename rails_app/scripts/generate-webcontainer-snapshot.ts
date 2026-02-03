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
} from "fs";
import { join } from "path";
import { execSync } from "child_process";

const TEMPLATE_DIR = join(process.cwd(), "templates", "default");
const TEMP_DIR = join(process.cwd(), ".snapshot-temp");
const OUTPUT_PATH = join(process.cwd(), "public", "webcontainer-snapshot.bin");

// Minimal dependencies for the snapshot - just enough to run Vite + React + Tailwind
// The full template deps are too large for snapshot generation
const MINIMAL_PACKAGE_JSON = {
  name: "landing-page-snapshot",
  private: true,
  type: "module",
  scripts: {
    dev: "vite --port 3000 --host",
    build: "vite build",
  },
  dependencies: {
    react: "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.462.0",
    clsx: "^2.1.1",
    "tailwind-merge": "^2.5.2",
    "class-variance-authority": "^0.7.1",
  },
  devDependencies: {
    vite: "^5.4.1",
    "@vitejs/plugin-react-swc": "^3.5.0",
    typescript: "^5.5.3",
    tailwindcss: "^3.4.11",
    postcss: "^8.4.47",
    autoprefixer: "^10.4.20",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "tailwindcss-animate": "^1.0.7",
  },
};

async function generateSnapshot() {
  console.log("Generating WebContainer snapshot...");
  console.log(`Using minimal template for snapshot generation`);

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

    // Write minimal package.json
    write(join(TEMP_DIR, "package.json"), JSON.stringify(MINIMAL_PACKAGE_JSON, null, 2));

    // Copy config files from template
    const configFiles = [
      "vite.config.ts",
      "tailwind.config.ts",
      "postcss.config.js",
      "tsconfig.json",
    ];
    for (const file of configFiles) {
      const srcPath = join(TEMPLATE_DIR, file);
      if (existsSync(srcPath)) {
        let content = readFileSync(srcPath, "utf-8");
        // Modify vite.config for WebContainer
        if (file === "vite.config.ts") {
          content = content
            .replace(/port:\s*\d+/, "port: 3000")
            .replace(/host:\s*["'][^"']*["']/, "host: true");
        }
        write(join(TEMP_DIR, file), content);
      }
    }

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

    // Install dependencies in temp directory
    // Using --install-links to avoid symlinks that the snapshot tool can't handle
    console.log("Installing dependencies (this may take a while)...");
    execSync("npm install --install-links", {
      cwd: TEMP_DIR,
      stdio: "inherit",
    });

    // Remove .bin directory which contains symlinks that can't be serialized
    const binDir = join(TEMP_DIR, "node_modules", ".bin");
    if (existsSync(binDir)) {
      console.log("Removing node_modules/.bin symlinks...");
      rmSync(binDir, { recursive: true, force: true });
    }

    // Generate the snapshot from the temp directory
    console.log("Generating snapshot binary...");
    const snapshotBuffer = await snapshot(TEMP_DIR);

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
