/**
 * Utilities for analyzing theme properties.
 */
import type { SemanticVariables, CodingPromptState } from "../types";

/**
 * Parse HSL string to extract lightness value.
 * Format: "30 20% 98%" or "0 0% 4%"
 * @returns Lightness as percentage (0-100) or null if invalid
 */
export function parseHSLLightness(hsl: string | undefined): number | null {
  if (!hsl) return null;

  // Match pattern like "30 20% 98%" - the last percentage is lightness
  const match = hsl.match(/(\d+(?:\.\d+)?)%\s*$/);
  if (match && match[1]) {
    return parseFloat(match[1]);
  }
  return null;
}

/**
 * Determine if the theme is dark based on background lightness.
 * @returns true if dark theme, false if light theme, null if cannot determine
 */
export function isDarkTheme(semanticVariables: SemanticVariables | undefined): boolean | null {
  if (!semanticVariables) return null;

  const backgroundHSL = semanticVariables["--background"];
  const lightness = parseHSLLightness(backgroundHSL);

  if (lightness === null) return null;

  // Lightness < 30% is considered dark
  return lightness < 30;
}

/**
 * Get theme mode string from state.
 */
export function getThemeMode(state: CodingPromptState): "dark" | "light" | "unknown" {
  const dark = isDarkTheme(state.theme?.semanticVariables);
  if (dark === null) return "unknown";
  return dark ? "dark" : "light";
}

/**
 * Get the primary color's HSL values if available.
 */
export function getPrimaryHSL(semanticVariables: SemanticVariables | undefined): {
  hue: number;
  saturation: number;
  lightness: number;
} | null {
  if (!semanticVariables) return null;

  const primaryHSL = semanticVariables["--primary"];
  if (!primaryHSL) return null;

  // Parse "197 37% 24%" format
  const match = primaryHSL.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match || !match[1] || !match[2] || !match[3]) return null;

  return {
    hue: parseFloat(match[1]),
    saturation: parseFloat(match[2]),
    lightness: parseFloat(match[3]),
  };
}
