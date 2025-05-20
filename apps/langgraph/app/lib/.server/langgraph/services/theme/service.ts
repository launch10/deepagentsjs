import chroma from 'chroma-js';
import type { InputTheme, ThemeOutput, ThemeWarning, ThemeResponse, ErrorResponse, ColorInfo, ServiceResponse } from './types';
import { 
  parseInput, 
  hexToColorInfo, 
  mapColorsToSemanticRoles, 
  deriveUIColors, 
  _selectBestOfTwoForegrounds as selectBestFgUtil, 
  _findContrastingForeground as deriveFgUtil, 
  _generateMutedForeground as generateMutedFgUtil, 
  calculateContrast 
} from './utils';
import { CONTRAST_REQUIREMENTS, CSS_VARIABLES, CONTRAST_COLORS } from './constants';

// --- Helper Function: Hex to CSS HSL String ---
/**
 * Converts a hex color string to a CSS HSL string (e.g., hsl(210, 40%, 98%)).
 * Handles potential NaN hue from chroma.js for grayscale colors.
 * @param hex - The hex color string (e.g., '#RRGGBB' or '#RGB').
 * @returns The CSS HSL string, or the original hex if conversion fails.
 */
export function hexToCssHsl(hex: string): string {
  try {
    const [h, s, l] = chroma(hex).hsl();
    // Handle NaN hue (grayscale) by setting hue to 0
    const hue = isNaN(h) ? 0 : Math.round(h);
    const saturation = Math.round(s * 100);
    const lightness = Math.round(l * 100);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } catch (error) {
    console.warn(`Failed to convert hex '${hex}' to HSL:`, error);
    return hex; // Return original hex as fallback
  }
}

// --- Main Generation Function --- 
/**
 * Generates a full color theme based on a small input theme.
 * Accepts a JSON string, an object matching InputTheme, or a direct array of hex color strings.
 * @param input - Raw input data (string, object, or string[]).
 * @returns A ServiceResponse object containing the theme and warnings, or an error.
 */
export function generateTheme(input: string | object | string[]): ServiceResponse {
  const warnings: ThemeWarning[] = [];
  let colorInfos: ColorInfo[];
  let inputTheme: InputTheme;

  if (Array.isArray(input)) {
    // Handle direct string array input
    inputTheme = { colors: input.map(c => c.startsWith('#') ? c.substring(1) : c) }; // Ensure # is removed for validation
    // Validate the colors directly
    const validationResult = validateAndProcessColors(inputTheme.colors);
    if ('error' in validationResult) {
      return validationResult; // Return error if validation fails
    }
    colorInfos = validationResult; // Assign validated ColorInfo array
  } else {
    // Handle object or JSON string input via parseInput
    const parsed = parseInput(input);
    if ('error' in parsed) {
      return parsed; // Return error from parseInput
    }
    inputTheme = parsed; // Assign parsed InputTheme
    // Validate the colors from the parsed input
    const validationResult = validateAndProcessColors(inputTheme.colors);
    if ('error' in validationResult) {
      return validationResult; // Return error if validation fails
    }
    colorInfos = validationResult; // Assign validated ColorInfo array
  }

  // --- Semantic Role Assignment ---
  const semanticMap = mapColorsToSemanticRoles(colorInfos);

  // --- UI Color Derivation ---
  const uiMap = deriveUIColors(semanticMap, warnings);

  // --- Combine all mapped colors ---
  const baseColorMap = new Map([...semanticMap, ...uiMap]);

  // --- Generate foregrounds (standard and muted) for relevant backgrounds (FR7, FR8) ---
  const finalCssVars: ThemeOutput = {};
  const backgroundVarNames = [
    CSS_VARIABLES.BACKGROUND,
    CSS_VARIABLES.PRIMARY,
    CSS_VARIABLES.SECONDARY,
    CSS_VARIABLES.MUTED,
    CSS_VARIABLES.ACCENT,
    CSS_VARIABLES.DESTRUCTIVE,
    CSS_VARIABLES.WARNING,
    CSS_VARIABLES.SUCCESS,
    CSS_VARIABLES.CARD,
    CSS_VARIABLES.RING,
    CSS_VARIABLES.POPOVER,
  ];

  baseColorMap.forEach((bgColorHex, bgVarName) => {
    // Check if the current variable is a standard background listed in backgroundVarNames
    const isStandardBackground = backgroundVarNames.includes(bgVarName);

    if (isStandardBackground) {
       finalCssVars[bgVarName] = hexToCssHsl(bgColorHex); 
    } else if (!bgVarName.endsWith('-foreground') && !bgVarName.endsWith('-foreground-muted')) {
        finalCssVars[bgVarName] = hexToCssHsl(bgColorHex);
    }

    if (isStandardBackground) {
      const fgVarName = `${bgVarName}-foreground`;
      const fgMutedVarName = `${fgVarName}-muted`;

      const bgColorInfo = hexToColorInfo(bgColorHex);
      if (!bgColorInfo) {
        // Should not happen if initial validation passed, but good to guard
        warnings.push({
          type: 'internal',
          message: `Could not process background color ${bgColorHex} for ${bgVarName} during foreground generation.`,
          affectedVariables: [bgVarName, fgVarName, fgMutedVarName]
        });
        finalCssVars[fgVarName] = hexToCssHsl(CONTRAST_COLORS.DARK); // Fallback
        finalCssVars[fgMutedVarName] = hexToCssHsl(CONTRAST_COLORS.DARK); // Fallback
        return; // Skip to next background color
      }

      // --- Standard Foreground Generation (using new _findContrastingForeground) ---
      const standardFgInfo = deriveFgUtil(bgColorInfo, CONTRAST_REQUIREMENTS.STANDARD);
      let standardFgHex = CONTRAST_COLORS.DARK; // Default fallback

      if (standardFgInfo) {
        standardFgHex = standardFgInfo.hex;
        finalCssVars[fgVarName] = hexToCssHsl(standardFgHex);
        const actualContrast = calculateContrast(bgColorHex, standardFgHex);
        if (actualContrast < CONTRAST_REQUIREMENTS.STANDARD) {
          warnings.push({
            type: 'contrast',
            message: `Derived foreground for ${bgVarName} (${bgColorHex}) does not meet ${CONTRAST_REQUIREMENTS.STANDARD}:1 contrast. Using ${standardFgHex} (${actualContrast.toFixed(2)}:1).`,
            affectedVariables: [bgVarName, fgVarName]
          });
        }
      } else {
        finalCssVars[fgVarName] = hexToCssHsl(standardFgHex); // Use fallback DARK
        warnings.push({
          type: 'contrast',
          message: `Could not derive a foreground for ${bgVarName} (${bgColorHex}). Defaulting to ${standardFgHex}.`,
          affectedVariables: [bgVarName, fgVarName]
        });
      }
      
      const actualStandardFgInfo = hexToColorInfo(standardFgHex); // Ensure we have ColorInfo for muted generation

      // --- Muted Foreground Generation (using new _generateMutedForeground) ---
      if (actualStandardFgInfo) {
        const mutedFgInfo = generateMutedFgUtil(actualStandardFgInfo, bgColorInfo, CONTRAST_REQUIREMENTS.MUTED_CONTEXT);
        if (mutedFgInfo) {
          finalCssVars[fgMutedVarName] = hexToCssHsl(mutedFgInfo.hex);
          const actualMutedContrast = calculateContrast(bgColorHex, mutedFgInfo.hex);
          if (actualMutedContrast < CONTRAST_REQUIREMENTS.MUTED_CONTEXT) {
            warnings.push({
              type: 'contrast',
              message: `Muted foreground for ${bgVarName} (${bgColorHex}) does not meet ${CONTRAST_REQUIREMENTS.MUTED_CONTEXT}:1 contrast. Using ${mutedFgInfo.hex} (${actualMutedContrast.toFixed(2)}:1).`,
              affectedVariables: [bgVarName, fgMutedVarName]
            });
          }
        } else {
          // Fallback for muted: use the standard foreground or a desaturated version of it
          finalCssVars[fgMutedVarName] = hexToCssHsl(standardFgHex); // Fallback to standard FG for muted
          warnings.push({
            type: 'contrast',
            message: `Could not generate a distinct muted foreground for ${bgVarName}. Using standard foreground ${standardFgHex}.`,
            affectedVariables: [bgVarName, fgMutedVarName]
          });
        }
      } else {
        // Should not happen if standardFgHex is set
        finalCssVars[fgMutedVarName] = hexToCssHsl(CONTRAST_COLORS.DARK); // Ultimate fallback
      }
    }
  });

  return {
    theme: finalCssVars,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// Helper function to validate and process colors
function validateAndProcessColors(colors: string[]): ColorInfo[] | ErrorResponse {
  const colorInfos = colors
    .map(hex => hexToColorInfo(hex))
    .filter(info => info !== null) as ColorInfo[]; // Filter out nulls from invalid hex

  if (colorInfos.length === 0 && colors.length > 0) {
    return { error: 'All input colors were invalid. Cannot generate theme.' }; // Return error if all colors are invalid
  }
  if (colorInfos.length === 0 && colors.length === 0) {
      return { error: 'No input colors provided. Cannot generate theme.' }; // Return error if no colors are provided
  }

  return colorInfos; // Return validated ColorInfo array
}
