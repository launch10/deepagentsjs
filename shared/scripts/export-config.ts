import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import * as config from "../config/index";
import * as Ads from "../types/ads/assets";

const __dirname = dirname(fileURLToPath(import.meta.url));
const exportsDir = join(__dirname, "..", "exports");

mkdirSync(exportsDir, { recursive: true });

for (const [name, value] of Object.entries(config)) {
  const outputPath = join(exportsDir, `${name}.json`);
  writeFileSync(outputPath, JSON.stringify(value, null, 2));
  console.log(`Exported ${name} -> ${outputPath}`);
}

const adsExports = {
  structuredSnippetCategories: Ads.StructuredSnippetCategories,
};

for (const [name, value] of Object.entries(adsExports)) {
  const outputPath = join(exportsDir, `${name}.json`);
  writeFileSync(outputPath, JSON.stringify(value, null, 2));
  console.log(`Exported ${name} -> ${outputPath}`);
}
