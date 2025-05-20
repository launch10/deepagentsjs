import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateTheme } from '../app/lib/.server/langgraph/services/theme/service';
import type { InputPalette, ThemeOutput, ThemeWarning, ServiceResponse } from '../app/lib/.server/langgraph/services/theme/types';

// Define a structure to hold the results for each palette
interface PaletteResult {
  inputPalette: InputPalette;
  theme?: ThemeOutput;
  warnings?: ThemeWarning[];
  error?: string;
}

// Get the directory name in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Construct paths
const projectRoot = path.resolve(__dirname, '..');
const themesFilePath = path.join(projectRoot, '.data', 'themes', 'themes.json');
const outputHtmlPath = path.join(__dirname, 'themePreview.html');

// Helper function to generate HTML content for all themes
function generateInteractiveHtml(results: PaletteResult[]): string {
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interactive Theme Preview</title>
  <style>
    body { font-family: sans-serif; padding: 20px; background-color: #f4f4f4; }
    .palette-container { display: none; border: 1px solid #ddd; margin-bottom: 20px; padding: 15px; background-color: #fff; border-radius: 8px; }
    .palette-container.active { display: block; }
    .container { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; margin-top: 15px; }
    .swatch { border: 1px solid #ccc; padding: 15px; border-radius: 5px; }
    .swatch h3 { margin-top: 0; font-size: 1.1em; word-wrap: break-word; }
    .swatch p { margin: 5px 0; font-size: 0.9em; }
    .swatch code { background-color: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 3px; font-size: 0.85em; }
    .warnings { background-color: #fff3cd; border: 1px solid #ffeeba; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
    .warnings h2 { margin-top: 0; font-size: 1.2em; }
    .warnings ul { margin: 0; padding-left: 20px; }
    .error { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
    .original-palette { margin-bottom: 15px; }
    .original-palette h2 { font-size: 1.2em; margin-bottom: 5px; }
    .original-palette span { display: inline-block; width: 20px; height: 20px; margin-right: 5px; border: 1px solid #ccc; vertical-align: middle; }
    .navigation { margin-bottom: 20px; text-align: center; }
    .navigation button { padding: 10px 20px; font-size: 1em; margin: 0 10px; cursor: pointer; }
    .palette-info { font-weight: bold; }
  </style>
</head>
<body>

<h1>Color Palette Interactive Preview</h1>

<div class="navigation">
  <button id="prevBtn">Previous</button>
  <span id="paletteInfo" class="palette-info">Palette 1 of ${results.length}</span>
  <button id="nextBtn">Next</button>
</div>
`;

  results.forEach((result, index) => {
    html += `<div class="palette-container ${index === 0 ? 'active' : ''}" id="palette-${index}">`;
    html += `<h2>Palette ${index + 1}</h2>`;

    // Display Original Colors
    html += `<div class="original-palette">
      <h3>Original Input Colors:</h3>
      ${result.inputPalette.colors.map(color => `<span style="background-color: ${color};"></span><code>${color}</code>`).join(' ')}
    </div>`;

    // Display Error if present
    if (result.error) {
      html += `<div class="error"><strong>Error generating theme:</strong> ${result.error}</div>`;
    } else {
      // Display Warnings if present
      if (result.warnings && result.warnings.length > 0) {
        html += '<div class="warnings"><h4>Warnings</h4><ul>';
        result.warnings.forEach(warning => {
          html += `<li><strong>[${warning.type}]</strong> ${warning.message} ${warning.affectedVariables ? '(Affected: <code>' + warning.affectedVariables.join('</code>, <code>') + '</code>)' : ''}</li>`;
        });
        html += '</ul></div>';
      }

      // Display Swatches
      html += '<div class="container">';
      const theme = result.theme || {};
      const groupedVars: { [key: string]: { bg?: string; fg?: string; fgMuted?: string } } = {};
      const otherVars: { [key: string]: string } = {};

      Object.entries(theme).forEach(([key, value]) => {
        if (key.endsWith('-foreground-muted')) {
           const base = key.replace('-foreground-muted', '');
           if (!groupedVars[base]) groupedVars[base] = {};
           groupedVars[base].fgMuted = value;
       } else if (key.endsWith('-foreground')) {
          const base = key.replace('-foreground', '');
          if (!groupedVars[base]) groupedVars[base] = {};
          groupedVars[base].fg = value;
       } else if (key.startsWith('--') && !key.includes('foreground')) {
          if (!groupedVars[key]) groupedVars[key] = {};
          groupedVars[key].bg = value;
       } else {
          otherVars[key] = value;
        }
      });


      Object.entries(groupedVars).forEach(([base, colors]) => {
        if (!colors.bg) return;
        html += `
          <div class="swatch" style="background-color: ${colors.bg}; color: ${colors.fg || '#000'};">
            <h3><code>${base}</code></h3>
            <p>BG: <code>${colors.bg}</code></p>
            ${colors.fg ? `<p>FG: <code style="color: ${colors.fg}; background-color: ${colors.bg};">${colors.fg}</code> (Standard Text)</p>` : '<p>FG: Not defined</p>'}
            ${colors.fgMuted ? `<p>FG Muted: <code style="color: ${colors.fgMuted}; background-color: ${colors.bg};">${colors.fgMuted}</code> (Muted Text)</p>` : '<p>FG Muted: Not defined</p>'}
          </div>
        `;
      });

      Object.entries(otherVars).forEach(([key, value]) => {
        if (key.includes('emphasis')) return;
        html += `
          <div class="swatch" style="background-color: #eee;">
            <h3><code>${key}</code></h3>
            <p>Value: <code>${value}</code></p>
            <p>(Not a standard background swatch)</p>
          </div>
        `;
      });

      html += '</div>'; // Close container
    }

    html += '</div>'; // Close palette-container
  });

  // Add JavaScript for navigation
  html += `
<script>
  let currentPaletteIndex = 0;
  const totalthemes = ${results.length};
  const paletteContainers = document.querySelectorAll('.palette-container');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const paletteInfo = document.getElementById('paletteInfo');

  function showPalette(index) {
    paletteContainers.forEach((container, i) => {
      container.classList.toggle('active', i === index);
    });
    paletteInfo.textContent = \`Palette \${index + 1} of \${totalthemes}\`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === totalthemes - 1;
  }

  prevBtn.addEventListener('click', () => {
    if (currentPaletteIndex > 0) {
      currentPaletteIndex--;
      showPalette(currentPaletteIndex);
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentPaletteIndex < totalthemes - 1) {
      currentPaletteIndex++;
      showPalette(currentPaletteIndex);
    }
  });

  // Initial setup
  showPalette(currentPaletteIndex);
</script>
</body>
</html>`;

  return html;
}

// --- Main Script Logic ---
try {
  // Read the JSON file
  const themesFileContent = fs.readFileSync(themesFilePath, 'utf-8');
  // Define the expected structure of each item in the themes array
  const themesData: { colors: string[]; labels?: string[] }[] = JSON.parse(themesFileContent);

  if (!themesData || themesData.length === 0) {
    throw new Error('No themes found in the JSON file or file is empty.');
  }

  const allResults: PaletteResult[] = [];

  // Process each palette
  themesData.forEach((paletteDef) => {
    const inputPalette: InputPalette = {
      colors: paletteDef.colors, // Pass hex codes directly
    };

    const result = generateTheme(inputPalette);
    const paletteResult: PaletteResult = { inputPalette };

    if ('error' in result) {
      paletteResult.error = `${result.error}${result.details ? ': ' + result.details : ''}`;
    } else {
      paletteResult.theme = result.theme;
      paletteResult.warnings = result.warnings;
    }
    allResults.push(paletteResult);
  });

  // Generate HTML content for all results
  const htmlContent = generateInteractiveHtml(allResults);

  // Write HTML to file
  fs.writeFileSync(outputHtmlPath, htmlContent, 'utf-8');
  console.log(`Interactive theme preview generated successfully: ${outputHtmlPath}`);

} catch (error: any) {
  console.error('Error reading or processing themes file:', error.message || error);
}