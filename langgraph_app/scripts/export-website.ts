#!/usr/bin/env npx tsx
/**
 * Export website files from database to shared/websites/examples
 *
 * Usage:
 *   pnpm run export-website <websiteId> [name]
 *   pnpm run export-website 123
 *   pnpm run export-website 123 my-custom-name
 */
import { WebsiteExporter } from "@services";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Usage: pnpm run export-website <websiteId> [name] [--overwrite]

Arguments:
  websiteId    The ID of the website to export
  name         Optional custom name for the export directory
  --overwrite  Overwrite existing directory if it exists

Examples:
  pnpm run export-website 123
  pnpm run export-website 123 my-project
  pnpm run export-website 123 my-project --overwrite
`);
    process.exit(0);
  }

  const websiteId = parseInt(args[0]!, 10);
  if (isNaN(websiteId)) {
    console.error("Error: websiteId must be a number");
    process.exit(1);
  }

  const overwrite = args.includes("--overwrite");
  const nameArg = args.find((a) => a !== "--overwrite" && a !== args[0]);

  try {
    const result = await WebsiteExporter.export({
      websiteId,
      name: nameArg,
      overwrite,
    });

    console.log(`\nExport complete!`);
    console.log(`  Path: ${result.exportPath}`);
    console.log(`  Files: ${result.fileCount}`);
    console.log(`\nTo run the example:`);
    console.log(`  cd ${result.exportPath}`);
    console.log(`  pnpm install --ignore-workspace`);
    console.log(`  pnpm dev`);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
