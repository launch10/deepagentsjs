import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateTheme } from '../app/lib/.server/langgraph/services/theme/service'; // Adjust path as needed
import type { ThemeOutput, ThemeWarning, ServiceResponse } from '../app/lib/.server/langgraph/services/theme/types'; // Adjust path as needed

// --- Define __dirname for ES Module scope ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // ---

interface InputPaletteEntry {
  colors: string[];
  labels: string[];
}

interface OutputPaletteEntry extends InputPaletteEntry {
  theme?: ThemeOutput;
  warnings?: ThemeWarning[];
  error?: string;
}

async function main() {
  const inputFilePath = path.resolve(__dirname, '../.data/themes/themes.json');
  const outputFilePath = path.resolve(__dirname, '../.data/themes/themes.output.json');
  const outputthemes: OutputPaletteEntry[] = [];

  console.log(`Reading themes from: ${inputFilePath}`);

  try {
    const fileContent = fs.readFileSync(inputFilePath, 'utf-8');
    const inputthemes: InputPaletteEntry[] = JSON.parse(fileContent);

    console.log(`Found ${inputthemes.length} themes to process.`);

    for (const inputPalette of inputthemes) {
      console.log(`Processing palette with colors: ${inputPalette.colors.join(', ')}`);
      // Ensure colors have '#' prefix if missing
      const processedColors = inputPalette.colors.map(c => c.startsWith('#') ? c : `#${c}`);

      const result: ServiceResponse = generateTheme(processedColors);
      const outputEntry: OutputPaletteEntry = {
        colors: inputPalette.colors, // Store original colors (without #)
        labels: inputPalette.labels,
      };

      if ('error' in result) {
        // Use result.error and optional result.details for the message
        const errorMessage = `${result.error}${result.details ? ': ' + result.details : ''}`;
        console.warn(`  Error generating theme for [${inputPalette.colors.join(', ')}]: ${errorMessage}`);
        outputEntry.error = errorMessage; // Store the combined error message
        // Warnings are not part of the ErrorResponse type, so don't try to access them here
      } else {
        // This block executes when result is ThemeResponse (success)
        console.log(`  Theme generated successfully for [${inputPalette.colors.join(', ')}].`);
        outputEntry.theme = result.theme;
        outputEntry.warnings = result.warnings || []; // Warnings exist on ThemeResponse
      }
      outputthemes.push(outputEntry);
    }

    console.log(`Writing ${outputthemes.length} processed themes to: ${outputFilePath}`);
    fs.writeFileSync(outputFilePath, JSON.stringify(outputthemes, null, 2));
    console.log('Successfully wrote output file.');

  } catch (error: any) {
    console.error('Error processing themes:', error.message || error);
    process.exit(1);
  }
}

main();
