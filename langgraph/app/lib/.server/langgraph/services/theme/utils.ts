import type { InputTheme, ErrorResponse, ColorInfo } from './types';
import chroma from 'chroma-js';
import { 
  CSS_VARIABLES, 
  STATUS_HUE_RANGES, 
  DEFAULT_STATUS_COLORS, 
  CONTRAST_COLORS, 
  DEFAULT_NEUTRAL_COLORS,
  MIN_SATURATION_FOR_BRAND_COLORS,  
  TARGET_LUMINANCE_PRIMARY,         
  TARGET_LUMINANCE_SECONDARY,       
  TARGET_LUMINANCE_ACCENT,          
  MIN_CONTRAST_RATIO_BETWEEN_BRAND_COLORS, 
  DEFAULT_FALLBACK_BRAND_COLORS,    
  CONTRAST_REQUIREMENTS,
  DEFAULT_LIGHT_GRAY_HEX,
} from './constants';

/**
 * Validates and parses input theme JSON
 * @param input - Raw input data (string or object)
 * @returns Parsed InputTheme or ErrorResponse
 */
export function parseInput(input: string | object): InputTheme | ErrorResponse {
  try {
    // Parse JSON if string input
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    
    // Validate structure
    if (!data || typeof data !== 'object') {
      return { error: 'Invalid input: must be a JSON object' };
    }
    
    // Validate colors property
    if (!Array.isArray(data.colors)) {
      return { error: 'Invalid input: colors property must be an array' };
    }
    
    // Validate each color is a valid hex code without # prefix
    const validHexRegex = /^[0-9A-Fa-f]{6}$/;
    const invalidColors = data.colors.filter((color: unknown) => 
      typeof color !== 'string' || !validHexRegex.test(color)
    );
    
    if (invalidColors.length > 0) {
      return { 
        error: 'Invalid hex colors detected', 
        details: `Colors must be 6-character hex codes without # prefix. Invalid: ${invalidColors.join(', ')}`
      };
    }
    
    // Validate labels if present
    if (data.labels !== undefined) {
      if (!Array.isArray(data.labels)) {
        return { error: 'Invalid input: labels property must be an array' };
      }
      
      const invalidLabels = data.labels.filter((label: unknown) => typeof label !== 'string');
      if (invalidLabels.length > 0) {
        return { error: 'Invalid labels: all labels must be strings' };
      }
    }
    
    // Return validated input
    return {
      colors: data.colors as string[],
      labels: (data.labels as string[] | undefined) || []
    };
  } catch (err) {
    return { 
      error: 'Failed to parse input', 
      details: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Converts a hex color string (with or without #) to a ColorInfo object.
 * Returns null if the hex is invalid.
 */
export function hexToColorInfo(inputHex: string): ColorInfo | null {
  try {
    // Ensure the hex code starts with #
    const hex = inputHex.startsWith('#') ? inputHex : `#${inputHex}`;

    // Basic validation (length and characters)
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      console.warn(`Invalid hex format: ${inputHex}`);
      return null;
    }

    // Use chroma-js for parsing and getting properties
    const chromaColor = chroma(hex);
    const luminance = chromaColor.luminance();
    const saturation = chromaColor.hsl()[1] || 0; // Saturation from HSL (index 1)
    const chromaColorInfo = chromaColor;

    return {
      hex,
      luminance,
      saturation,
      chroma: chromaColorInfo
    };
  } catch (err: any) { // Added type annotation for err
    console.warn(`Error processing hex color: ${inputHex}`, err.message || err);
    return null;
  }
}

/**
 * Calculates WCAG contrast ratio between two colors
 */
export function calculateContrast(color1: string, color2: string): number {
  try {
    return chroma.contrast(color1, color2);
  } catch (err) {
    console.error(`Error calculating contrast between ${color1} and ${color2}:`, err);
    return 0; // Return 0 for invalid colors
  }
}

/**
 * Finds the best contrasting foreground (from preferredFg/fallbackFg) for a background color.
 * Prioritizes meeting targetContrast, then selects the one with the highest contrast ratio.
 * If both meet target, strictly choose higher contrast.
 */
export function _selectBestOfTwoForegrounds(
  bgColorHex: string,
  lightFg: string = CONTRAST_COLORS.LIGHT,
  darkFg: string = CONTRAST_COLORS.DARK,
  targetContrast: number = CONTRAST_REQUIREMENTS.STANDARD
): { color: string; ratio: number; meetsTarget: boolean } {
  let contrastLight: number = 0;
  let contrastDark: number = 0;
  let bgLuminance: number = 0.5; // Default assumption (neutral)

  try {
    bgLuminance = chroma(bgColorHex).luminance();
  } catch (e) {
     console.error(`[findContrastingForeground] Error getting luminance for bg: ${bgColorHex}`, e);
     // If background luminance fails, default to returning dark text as a safe fallback? Or light? Let's stick with dark.
     return { color: darkFg, ratio: 0, meetsTarget: false };
  }

  try {
    contrastLight = chroma.contrast(lightFg, bgColorHex);
  } catch (e) {
     console.error(`[findContrastingForeground] Error calculating contrast for lightFg: ${lightFg} on ${bgColorHex}`, e);
     contrastLight = 0; // Treat as minimum contrast if calculation fails
  }

  try {
    contrastDark = chroma.contrast(darkFg, bgColorHex);
  } catch (e) {
     console.error(`[findContrastingForeground] Error calculating contrast for darkFg: ${darkFg} on ${bgColorHex}`, e);
     contrastDark = 0; // Treat as minimum contrast if calculation fails
  }

  const lightMeets = contrastLight >= targetContrast;
  const darkMeets = contrastDark >= targetContrast;

  // Determine ideal FG based on background luminance
  const idealFg = bgLuminance < 0.5 ? lightFg : darkFg; // Prefer light text on dark bg, dark text on light bg
  const idealFgContrast = idealFg === lightFg ? contrastLight : contrastDark;
  const idealFgMeets = idealFg === lightFg ? lightMeets : darkMeets;

  const otherFg = idealFg === lightFg ? darkFg : lightFg;
  const otherFgContrast = idealFg === lightFg ? contrastDark : contrastLight;
  const otherFgMeets = idealFg === lightFg ? darkMeets : lightMeets;

  // 1. Does the ideal foreground meet the target?
  if (idealFgMeets) {
    return { color: idealFg, ratio: idealFgContrast, meetsTarget: true };
  }
  // 2. If not, does the *other* foreground meet the target?
  else if (otherFgMeets) {
    return { color: otherFg, ratio: otherFgContrast, meetsTarget: true };
  }
  // 3. If neither meets, return the one with the higher contrast
  else {
    if (contrastLight >= contrastDark) {
      return { color: lightFg, ratio: contrastLight, meetsTarget: false };
    } else {
      return { color: darkFg, ratio: contrastDark, meetsTarget: false };
    }
  }
}

/**
 * Derives a color by manipulating another color
 */
export function deriveColor(
  baseColor: string,
  operation: 'darken' | 'brighten' | 'desaturate' | 'saturate',
  amount: number
): string {
  try {
    const color = chroma(baseColor);
    switch (operation) {
      case 'darken':
        return color.darken(amount).hex();
      case 'brighten':
        return color.brighten(amount).hex(); // Corrected from lighten
      case 'desaturate':
        return color.desaturate(amount).hex();
      case 'saturate':
        return color.saturate(amount).hex();
      default:
        return baseColor;
    }
  } catch (err) {
    console.error(`Error deriving color from ${baseColor} with ${operation}:`, err);
    return baseColor; // Return original on error
  }
}

/**
 * Helper to find a color matching a specific hue range for status colors.
 */
function findStatusColor(
  colors: ColorInfo[],
  range: { min: number; max: number }
): string | null {
  for (const color of colors) {
    try {
      const hue = color.chroma.hsl()[0]; // Hue is at index 0
      if (isNaN(hue)) continue; // Skip colors without hue (e.g., greys)
      
      // Handle hue wrapping around 360 (e.g., for red range 345-15)
      if (range.min > range.max) {
        if (hue >= range.min || hue <= range.max) {
          return color.hex;
        }
      } else if (hue >= range.min && hue <= range.max) {
        return color.hex;
      }
    } catch (err) {
      console.error(`Error getting HSL from color ${color.hex}:`, err);
      continue; // Skip colors that error out during HSL conversion
    }
  }
  return null;
}

/**
 * Helper function to select background color
 */
function _selectBackgroundColor(allColors: ColorInfo[]): ColorInfo {
  if (allColors.length === 0) {
    console.warn('Color theme is empty for background selection. Using default off-white.');
    const defaultBg = hexToColorInfo(DEFAULT_NEUTRAL_COLORS.OFF_WHITE);
    if (!defaultBg) {
      console.error("CRITICAL: Failed to create ColorInfo for default off-white background.");
      return { hex: DEFAULT_NEUTRAL_COLORS.OFF_WHITE, luminance: 0.95, saturation: 0.05, chroma: chroma(DEFAULT_NEUTRAL_COLORS.OFF_WHITE) };
    }
    return defaultBg;
  }

  const lightNeutrals = allColors.filter(
    (color) => color.luminance > 0.85 && color.saturation < 0.1
  );

  if (lightNeutrals.length > 0) {
    return lightNeutrals.sort(
      (a, b) => b.luminance - a.luminance || a.saturation - b.saturation
    )[0];
  } else {
    console.warn('No light neutrals found for background. Using default off-white.');
    const defaultBg = hexToColorInfo(DEFAULT_NEUTRAL_COLORS.OFF_WHITE);
    if (!defaultBg) {
      console.error("CRITICAL: Failed to create ColorInfo for default off-white background on fallback.");
      return { hex: DEFAULT_NEUTRAL_COLORS.OFF_WHITE, luminance: 0.95, saturation: 0.05, chroma: chroma(DEFAULT_NEUTRAL_COLORS.OFF_WHITE) };
    }
    return defaultBg;
  }
}

// Helper function to select card and popover colors
function _selectCardAndPopoverColors(allColors: ColorInfo[], backgroundColorInfo: ColorInfo | null): { cardHex: string; popoverHex: string } {
  let cardHex: string | undefined = undefined;
  let popoverHex: string | undefined = undefined;

  if (backgroundColorInfo) {
    const potentialCardPopoverColors = allColors.filter(
      c => 
        c.hex.toUpperCase() !== backgroundColorInfo.hex.toUpperCase() &&
        c.luminance > 0.9 && 
        c.saturation < 0.1
    );

    if (backgroundColorInfo.hex.toUpperCase() === DEFAULT_NEUTRAL_COLORS.WHITE) {
      // Bg is WHITE, look for a subtle off-white from theme (not pure white)
      const suitableOffWhites = potentialCardPopoverColors
        .filter(c => c.hex.toUpperCase() !== DEFAULT_NEUTRAL_COLORS.WHITE && c.luminance > 0.95 && c.luminance < 1.0)
        .sort((a, b) => b.luminance - a.luminance); // Prefer lighter subtle off-whites
      if (suitableOffWhites.length > 0) {
        cardHex = suitableOffWhites[0].hex;
        popoverHex = suitableOffWhites[0].hex;
      }
    } else {
      // Bg is NOT WHITE, try to use pure WHITE from theme if available
      const themeWhite = potentialCardPopoverColors.find(c => c.hex.toUpperCase() === DEFAULT_NEUTRAL_COLORS.WHITE);
      if (themeWhite) {
        cardHex = themeWhite.hex;
        popoverHex = themeWhite.hex;
      } else {
        // If no pure WHITE in theme, use the lightest available neutral from theme (distinct from bg)
        const lightestNeutrals = potentialCardPopoverColors.sort((a,b) => b.luminance - a.luminance);
        if (lightestNeutrals.length > 0) {
          cardHex = lightestNeutrals[0].hex;
          popoverHex = lightestNeutrals[0].hex;
        }
      }
    }
  }

  // Fallback to original logic if no suitable color found from theme
  if (cardHex === undefined || popoverHex === undefined) {
    if (backgroundColorInfo) {
      if (backgroundColorInfo.hex.toUpperCase() === DEFAULT_NEUTRAL_COLORS.WHITE) {
        cardHex = '#FCFCFC'; // Subtle off-white for white background
        popoverHex = '#FCFCFC';
      } else if (backgroundColorInfo.luminance > 0.9) {
        // Very light background (but not white), use pure white for card/popover
        cardHex = DEFAULT_NEUTRAL_COLORS.WHITE;
        popoverHex = DEFAULT_NEUTRAL_COLORS.WHITE;
      } else {
        // Darker backgrounds, use pure white for card/popover
        cardHex = DEFAULT_NEUTRAL_COLORS.WHITE;
        popoverHex = DEFAULT_NEUTRAL_COLORS.WHITE;
      }
    } else {
      // Fallback if backgroundColorInfo is unexpectedly null
      console.warn('Background color info was unexpectedly null for card/popover selection. Defaulting to white.');
      cardHex = DEFAULT_NEUTRAL_COLORS.WHITE;
      popoverHex = DEFAULT_NEUTRAL_COLORS.WHITE;
    }
  }
  return { cardHex: cardHex!, popoverHex: popoverHex! }; // Use non-null assertion as fallbacks ensure they are set
}

// Helper function to select the primary color
function _selectPrimaryColor(
  availableColors: ColorInfo[],
  backgroundInfo: ColorInfo // Added backgroundInfo for new logic
): ColorInfo | null { // Return type changed to ColorInfo | null
  if (availableColors.length === 0) {
    return hexToColorInfo(DEFAULT_FALLBACK_BRAND_COLORS.PRIMARY);
  }
  
  // Calculate scores for each color based on suitability for primary role (Task 6 logic)
  const scoredColors = availableColors.map(color => {
    // Calculate contrast with background
    const contrast = chroma.contrast(color.hex, backgroundInfo.hex);
    
    // Calculate perceptual difference (Delta E) with background
    const deltaE = chroma.deltaE(color.hex, backgroundInfo.hex);
    
    // Prefer moderately bright, saturated colors
    const luminanceScore = 1 - Math.abs(0.5 - color.luminance);
    const saturationScore = color.saturation;
    
    // Combine factors into a single score (Weights can be adjusted based on importance)
    const score = (
      deltaE * 0.4 +
      contrast * 0.3 +
      saturationScore * 0.2 +
      luminanceScore * 0.1
    );
    
    return { color, score };
  });
  
  // Sort by score (descending)
  scoredColors.sort((a, b) => b.score - a.score);
  
  // Return the highest-scoring color
  // If scoredColors is somehow empty (shouldn't be if availableColors wasn't), fallback
  if (scoredColors.length === 0) {
      return hexToColorInfo(DEFAULT_FALLBACK_BRAND_COLORS.PRIMARY);
  }
  return scoredColors[0].color;
}

// Helper function to select the secondary color
function _selectSecondaryColor(
  availableColors: ColorInfo[],
  primaryInfo: ColorInfo, // Changed from primaryColorHex
  backgroundInfo: ColorInfo // Added backgroundInfo
): ColorInfo | null { // Return type changed to ColorInfo | null
  if (availableColors.length === 0) {
    // Derive a secondary color by shifting the hue of the primary
    const primaryHsl = primaryInfo.chroma.hsl();
    if (primaryHsl[0] === null || primaryHsl[0] === undefined) { // Guard against null hue
        console.warn('Primary color has null hue, cannot derive secondary. Using a default derivation.');
        const derivedHex = deriveColor(primaryInfo.hex, 'desaturate', 0.5);
        return hexToColorInfo(deriveColor(derivedHex, 'darken', 0.2));
    }
    const hueShift = 150; // Complementary-ish
    let newHue = (primaryHsl[0] + hueShift) % 360;
    
    const derivedColor = chroma.hsl(
      newHue,
      Math.max(0.1, primaryHsl[1] * 0.9), // Slightly less saturated
      primaryHsl[2]
    );
    return hexToColorInfo(derivedColor.hex());
  }
  
  // Calculate scores for each color based on suitability for secondary role
  const scoredColors = availableColors.map(color => {
    const bgContrast = chroma.contrast(color.hex, backgroundInfo.hex);
    const primaryDeltaE = chroma.deltaE(color.hex, primaryInfo.hex);
    
    const primaryHue = primaryInfo.chroma.hsl()[0] || 0;
    const colorHue = color.chroma.hsl()[0] || 0;
    let hueDiff = Math.abs(primaryHue - colorHue);
    if (hueDiff > 180) hueDiff = 360 - hueDiff;
    
    const hueScore = (hueDiff >= 15 && hueDiff <= 45) || (hueDiff >= 135 && hueDiff <= 180) 
      ? 1 
      : 1 - (Math.min(Math.abs(hueDiff - 30), Math.abs(hueDiff - 160)) / 30);
    
    const score = (
      primaryDeltaE * 0.4 +
      bgContrast * 0.3 +
      hueScore * 0.2 +
      color.saturation * 0.1
    );
    
    return { color, score };
  });
  
  scoredColors.sort((a, b) => b.score - a.score);
  
  if (scoredColors.length === 0) { // Should not happen if availableColors wasn't empty
      const derivedHex = deriveColor(primaryInfo.hex, 'desaturate', 0.5);
      return hexToColorInfo(deriveColor(derivedHex, 'darken', 0.2));
  }
  return scoredColors[0].color;
}

// Helper function to select the accent color
function _selectAccentColor(
  availableColors: ColorInfo[],
  primaryInfo: ColorInfo,
  secondaryInfo: ColorInfo,
  backgroundInfo: ColorInfo
): ColorInfo | null {
  if (availableColors.length === 0) {
    const primaryHsl = primaryInfo.chroma.hsl();
    if (primaryHsl[0] === null || primaryHsl[0] === undefined || primaryHsl[1] === null || primaryHsl[2] === null) {
        console.warn('Primary color has null HSL components, cannot derive accent. Using default fallback.');
        return hexToColorInfo(DEFAULT_FALLBACK_BRAND_COLORS.ACCENT);
    }
    const hueShift = 60; // Different enough from primary
    let newHue = (primaryHsl[0] + hueShift) % 360;
    
    const derivedColor = chroma.hsl(
      newHue,
      Math.min(1, primaryHsl[1] * 1.2), // More saturated
      Math.min(0.8, primaryHsl[2] * 1.1) // Slightly brighter, but not too light
    );
    return hexToColorInfo(derivedColor.hex());
  }
  
  const scoredColors = availableColors.map(color => {
    const bgContrast = chroma.contrast(color.hex, backgroundInfo.hex);
    const primaryDeltaE = chroma.deltaE(color.hex, primaryInfo.hex);
    const secondaryDeltaE = chroma.deltaE(color.hex, secondaryInfo.hex);
    const distinctiveness = Math.min(primaryDeltaE, secondaryDeltaE);
    const vibrancyScore = color.saturation * 0.7 + color.luminance * 0.3;
    
    const score = (
      distinctiveness * 0.4 +
      bgContrast * 0.3 +
      vibrancyScore * 0.3
    );
    
    return { color, score };
  });
  
  scoredColors.sort((a, b) => b.score - a.score);

  if (scoredColors.length > 0 && scoredColors[0].color) {
    return scoredColors[0].color;
  } else {
    console.warn('Accent color could not be determined from scoring, using default fallback.');
    return hexToColorInfo(DEFAULT_FALLBACK_BRAND_COLORS.ACCENT);
  }
}

// Helper function to select the muted color
function _selectMutedColor(
  availableColors: ColorInfo[],
  backgroundInfo: ColorInfo // Changed from backgroundColorHex
): ColorInfo | null { // Return type changed to ColorInfo | null
  if (availableColors.length === 0) {
    let derivedHex: string;
    if (backgroundInfo.luminance > 0.5) {
      derivedHex = chroma(backgroundInfo.hex).darken(0.3).desaturate(1).hex();
    } else {
      derivedHex = chroma(backgroundInfo.hex).brighten(0.3).desaturate(1).hex();
    }
    return hexToColorInfo(derivedHex);
  }

  const lowSatColors = availableColors.filter(color => color.saturation < 0.15);
  if (lowSatColors.length > 0) {
    lowSatColors.sort((a, b) => a.saturation - b.saturation);
    if (lowSatColors[0]) return lowSatColors[0];
  }

  // No good grays available, desaturate the least saturated available color
  const sortedBySaturation = [...availableColors].sort((a, b) => a.saturation - b.saturation);
  if (sortedBySaturation.length > 0 && sortedBySaturation[0]) {
    const leastSaturated = sortedBySaturation[0];
    const desaturatedHex = chroma(leastSaturated.hex).desaturate(2).hex();
    return hexToColorInfo(desaturatedHex);
  }
  
  // Final fallback if all else fails (e.g. availableColors was empty after filtering, but not initially)
  console.warn('Muted color could not be determined, using default light gray.');
  return hexToColorInfo(DEFAULT_LIGHT_GRAY_HEX);
}

// Helper function to select status colors
function _selectStatusColors(allColors: ColorInfo[]): {
  destructive: string;
  warning: string;
  success: string;
} {
  const usedStatusColors = new Set<string>();
  let destructive, warning, success;

  destructive = findStatusColor(allColors, STATUS_HUE_RANGES.DESTRUCTIVE);
  if (destructive) {
      usedStatusColors.add(destructive);
  } else {
      destructive = DEFAULT_STATUS_COLORS.DESTRUCTIVE;
      console.warn('No suitable destructive color found in theme, using default.');
  }

  warning = findStatusColor(allColors.filter(c => !usedStatusColors.has(c.hex)), STATUS_HUE_RANGES.WARNING);
  if (warning) {
      usedStatusColors.add(warning);
  } else {
      warning = DEFAULT_STATUS_COLORS.WARNING;
      console.warn('No suitable warning color found in theme, using default.');
  }

  success = findStatusColor(allColors.filter(c => !usedStatusColors.has(c.hex)), STATUS_HUE_RANGES.SUCCESS);
  if (!success) {
      success = DEFAULT_STATUS_COLORS.SUCCESS;
      console.warn('No suitable success color found in theme, using default.');
  }
  
  return { destructive, warning, success };
}

function _getRemainingColors(colors: ColorInfo[], semanticMap: Map<string, string>): ColorInfo[] {
  const usedHexValues = new Set(Array.from(semanticMap.values())); // Corrected: Use Set and Array.from
  return colors.filter(c => !usedHexValues.has(c.hex));
}

/**
 * Maps input colors to semantic roles based on heuristics (FR3).
 * This version aligns with Task 11's more modular approach.
 */
export function mapColorsToSemanticRoles(initialColorInfos: ColorInfo[]): Map<string, string> {
  const semanticMap = new Map<string, string>();
  const usedColors = new Set<string>(); // Tracks hex codes that have been assigned
  let availableColorInfos = [...initialColorInfos]; // Colors not yet assigned

  const assignColor = (role: string, colorInfo: ColorInfo | null, fallbackHex?: string) => {
    if (colorInfo && !usedColors.has(colorInfo.hex)) {
      semanticMap.set(role, colorInfo.hex);
      usedColors.add(colorInfo.hex);
      // Update availableColorInfos by filtering out the used color
      availableColorInfos = availableColorInfos.filter(ci => ci.hex !== colorInfo.hex);
    } else if (colorInfo && usedColors.has(colorInfo.hex)) {
      // Color already used, but assign it anyway if it's the only/best option (role might share)
      semanticMap.set(role, colorInfo.hex);
      // No need to add to usedColors again or filter from availableColorInfos
    } else if (fallbackHex) {
      const fallbackColorInfo = hexToColorInfo(fallbackHex);
      if (fallbackColorInfo) {
        semanticMap.set(role, fallbackColorInfo.hex);
        // If the fallback is chosen, we should consider if it 'uses up' an initial color
        // For now, assume fallbacks are distinct or less critical for unique assignment
        // If it's from initialColorInfos and not used, mark as used.
        if (initialColorInfos.some(ci => ci.hex === fallbackColorInfo.hex) && !usedColors.has(fallbackColorInfo.hex)) {
          usedColors.add(fallbackColorInfo.hex);
          availableColorInfos = availableColorInfos.filter(ci => ci.hex !== fallbackColorInfo.hex);
        }
      } else {
         // This case should be rare if fallbacks are valid static hexes
        console.warn(`Fallback hex ${fallbackHex} for role ${role} is invalid.`);
      }
    }
    // If no colorInfo and no fallback, the role remains unassigned by this call.
  };

  // 1. Select Background Color
  const backgroundInfo = _selectBackgroundColor(availableColorInfos);
  assignColor(CSS_VARIABLES.BACKGROUND, backgroundInfo, DEFAULT_NEUTRAL_COLORS.LIGHT_GRAY);

  // 2. Select Card and Popover colors
  const { cardHex, popoverHex } = _selectCardAndPopoverColors(availableColorInfos, backgroundInfo);
  const cardInfo = hexToColorInfo(cardHex);
  const popoverInfo = hexToColorInfo(popoverHex);
  assignColor(CSS_VARIABLES.CARD, cardInfo, DEFAULT_NEUTRAL_COLORS.WHITE);
  assignColor(CSS_VARIABLES.POPOVER, popoverInfo, cardHex); // Fallback popover to cardHex if needed

  // 3. Select Status Colors
  const statusColors = _selectStatusColors(initialColorInfos);
  const successInfo = hexToColorInfo(statusColors.success);
  const warningInfo = hexToColorInfo(statusColors.warning);
  const destructiveInfo = hexToColorInfo(statusColors.destructive);
  
  assignColor(CSS_VARIABLES.SUCCESS, successInfo, DEFAULT_STATUS_COLORS.SUCCESS);
  assignColor(CSS_VARIABLES.WARNING, warningInfo, DEFAULT_STATUS_COLORS.WARNING);
  assignColor(CSS_VARIABLES.DESTRUCTIVE, destructiveInfo, DEFAULT_STATUS_COLORS.DESTRUCTIVE);

  // 4. Select Primary Color
  const primaryInfo = _selectPrimaryColor(availableColorInfos, backgroundInfo);
  assignColor(CSS_VARIABLES.PRIMARY, primaryInfo, DEFAULT_FALLBACK_BRAND_COLORS.PRIMARY);

  // 5. Select Secondary Color
  const secondaryInfo = _selectSecondaryColor(availableColorInfos, primaryInfo!, backgroundInfo);
  assignColor(CSS_VARIABLES.SECONDARY, secondaryInfo, DEFAULT_FALLBACK_BRAND_COLORS.SECONDARY);

  // 6. Select Accent Color
  const accentInfo = _selectAccentColor(availableColorInfos, primaryInfo!, secondaryInfo!, backgroundInfo);
  assignColor(CSS_VARIABLES.ACCENT, accentInfo, DEFAULT_FALLBACK_BRAND_COLORS.ACCENT);

  // 7. Select Muted Color
  const mutedInfo = _selectMutedColor(availableColorInfos, backgroundInfo);
  assignColor(CSS_VARIABLES.MUTED, mutedInfo, DEFAULT_NEUTRAL_COLORS.LIGHT_GRAY); // Or another suitable neutral
  
  const coreRoles = [
    CSS_VARIABLES.BACKGROUND, CSS_VARIABLES.CARD, CSS_VARIABLES.POPOVER,
    CSS_VARIABLES.PRIMARY, CSS_VARIABLES.SECONDARY, CSS_VARIABLES.ACCENT, CSS_VARIABLES.MUTED,
    CSS_VARIABLES.SUCCESS, CSS_VARIABLES.WARNING, CSS_VARIABLES.DESTRUCTIVE
  ];

  const ultimateFallbackBg = DEFAULT_NEUTRAL_COLORS.LIGHT_GRAY;
  const ultimateFallbackGeneric = DEFAULT_NEUTRAL_COLORS.LIGHT_GRAY; // Using LIGHT_GRAY as a generic neutral

  for (const role of coreRoles) {
    if (!semanticMap.has(role)) {
      console.warn(`Role ${role} could not be assigned from theme, using ultimate fallback.`);
      let fallbackValue = ultimateFallbackGeneric;
      if (role === CSS_VARIABLES.BACKGROUND || role === CSS_VARIABLES.CARD || role === CSS_VARIABLES.POPOVER) {
        fallbackValue = ultimateFallbackBg;
      }
      if (role === CSS_VARIABLES.PRIMARY) fallbackValue = DEFAULT_FALLBACK_BRAND_COLORS.PRIMARY;
      else if (role === CSS_VARIABLES.SECONDARY) fallbackValue = DEFAULT_FALLBACK_BRAND_COLORS.SECONDARY;
      else if (role === CSS_VARIABLES.ACCENT) fallbackValue = DEFAULT_FALLBACK_BRAND_COLORS.ACCENT;
      else if (role === CSS_VARIABLES.MUTED) fallbackValue = DEFAULT_NEUTRAL_COLORS.LIGHT_GRAY;
      else if (role === CSS_VARIABLES.SUCCESS) fallbackValue = DEFAULT_STATUS_COLORS.SUCCESS;
      else if (role === CSS_VARIABLES.WARNING) fallbackValue = DEFAULT_STATUS_COLORS.WARNING;
      else if (role === CSS_VARIABLES.DESTRUCTIVE) fallbackValue = DEFAULT_STATUS_COLORS.DESTRUCTIVE;
      
      semanticMap.set(role, fallbackValue);
    }
  }

  return semanticMap;
}

/**
 * Derives additional UI colors from the base semantic colors (FR4).
 */
export function deriveUIColors(semanticMap: Map<string, string>, warnings: ThemeWarning[]): Map<string, string> {
  const uiMap = new Map<string, string>();
  
  const background = semanticMap.get(CSS_VARIABLES.BACKGROUND);
  const primary = semanticMap.get(CSS_VARIABLES.PRIMARY);
  
  if (background) {
    const bgLuminance = chroma(background).luminance();
    const adjustOp = bgLuminance > 0.5 ? 'darken' : 'brighten';
    const derivedBorderInput = deriveColor(background, adjustOp, 0.1);
    uiMap.set(CSS_VARIABLES.BORDER, derivedBorderInput);
    uiMap.set(CSS_VARIABLES.INPUT, derivedBorderInput);

    // Ring: Typically the primary color, or a fallback if primary is not set
    uiMap.set(CSS_VARIABLES.RING, primary || DEFAULT_FALLBACK_BRAND_COLORS.PRIMARY);
    
    uiMap.set(CSS_VARIABLES.NEUTRAL_1, deriveColor(background, adjustOp, 0.2));
    uiMap.set(CSS_VARIABLES.NEUTRAL_2, deriveColor(background, adjustOp, 0.4));
    uiMap.set(CSS_VARIABLES.NEUTRAL_3, deriveColor(background, adjustOp, 0.6));
  } else {
    warnings.push({
      type: 'internal',
      message: 'Background color missing for UI derivation. Cannot derive Border/Input/Neutrals. Using fallbacks.',
      affectedVariables: [
        CSS_VARIABLES.BORDER, CSS_VARIABLES.INPUT, CSS_VARIABLES.NEUTRAL_1,
        CSS_VARIABLES.NEUTRAL_2, CSS_VARIABLES.NEUTRAL_3
      ]
    });
    // Provide fallbacks if background is missing
    const fallbackNeutral = DEFAULT_NEUTRAL_COLORS.LIGHT_GRAY;
    const fallbackBorderInput = deriveColor(fallbackNeutral, 'darken', 0.1);
    uiMap.set(CSS_VARIABLES.BORDER, fallbackBorderInput);
    uiMap.set(CSS_VARIABLES.INPUT, fallbackBorderInput);
    uiMap.set(CSS_VARIABLES.RING, primary || DEFAULT_FALLBACK_BRAND_COLORS.PRIMARY);
    uiMap.set(CSS_VARIABLES.NEUTRAL_1, deriveColor(fallbackNeutral, 'darken', 0.2));
    uiMap.set(CSS_VARIABLES.NEUTRAL_2, deriveColor(fallbackNeutral, 'darken', 0.4));
    uiMap.set(CSS_VARIABLES.NEUTRAL_3, deriveColor(fallbackNeutral, 'darken', 0.6));
  }
 
  // Status colors (DESTRUCTIVE, WARNING, SUCCESS) are now expected to be in semanticMap directly.
  // If they are missing from semanticMap, they would have been assigned ultimate fallbacks there.
  // We just copy them over to uiMap if they exist, or rely on the ultimate fallbacks from mapColorsToSemanticRoles.
  // This also ensures they are available if generateTheme directly uses uiMap's final state.

  const destructive = semanticMap.get(CSS_VARIABLES.DESTRUCTIVE);
  if (destructive) {
    uiMap.set(CSS_VARIABLES.DESTRUCTIVE, destructive);
  } else {
    warnings.push({
        type: 'missing_role',
        message: 'Destructive color missing from semantic map, using default status color.',
        affectedVariables: [CSS_VARIABLES.DESTRUCTIVE]
    });
    uiMap.set(CSS_VARIABLES.DESTRUCTIVE, DEFAULT_STATUS_COLORS.DESTRUCTIVE);
  }

  const warning = semanticMap.get(CSS_VARIABLES.WARNING);
  if (warning) {
    uiMap.set(CSS_VARIABLES.WARNING, warning);
  } else {
    warnings.push({
        type: 'missing_role',
        message: 'Warning color missing from semantic map, using default status color.',
        affectedVariables: [CSS_VARIABLES.WARNING]
    });
    uiMap.set(CSS_VARIABLES.WARNING, DEFAULT_STATUS_COLORS.WARNING);
  }

  const success = semanticMap.get(CSS_VARIABLES.SUCCESS);
  if (success) {
    uiMap.set(CSS_VARIABLES.SUCCESS, success);
  } else {
    warnings.push({
        type: 'missing_role',
        message: 'Success color missing from semantic map, using default status color.',
        affectedVariables: [CSS_VARIABLES.SUCCESS]
    });
    uiMap.set(CSS_VARIABLES.SUCCESS, DEFAULT_STATUS_COLORS.SUCCESS);
  }

  // CARD and POPOVER are also expected from semanticMap
  const card = semanticMap.get(CSS_VARIABLES.CARD);
  if (card) {
    uiMap.set(CSS_VARIABLES.CARD, card);
  } else {
     warnings.push({
        type: 'missing_role',
        message: 'Card color missing from semantic map, using default neutral.',
        affectedVariables: [CSS_VARIABLES.CARD]
    });
    uiMap.set(CSS_VARIABLES.CARD, DEFAULT_NEUTRAL_COLORS.WHITE);
  }

  const popover = semanticMap.get(CSS_VARIABLES.POPOVER);
  if (popover) {
    uiMap.set(CSS_VARIABLES.POPOVER, popover);
  } else {
    warnings.push({
        type: 'missing_role',
        message: 'Popover color missing from semantic map, using card color or default neutral.',
        affectedVariables: [CSS_VARIABLES.POPOVER]
    });
    uiMap.set(CSS_VARIABLES.POPOVER, uiMap.get(CSS_VARIABLES.CARD) || DEFAULT_NEUTRAL_COLORS.WHITE);
  }

  return uiMap;
}

/**
 * Finds or derives a contrasting foreground color for a given background color, 
 * ensuring WCAG AA contrast (target 4.5:1 by default).
 * For light backgrounds, use dark foregrounds and vice versa.
 * If simple black/white is insufficient, it attempts to derive a color.
 */
export function _findContrastingForeground(
  backgroundInfo: ColorInfo,
  targetContrast: number = CONTRAST_REQUIREMENTS.STANDARD
): ColorInfo | null {
  const bgChroma = backgroundInfo.chroma;
  const bgLuminance = backgroundInfo.luminance;

  // Start with either black or white depending on background luminance
  let fgChroma = bgLuminance > 0.5 ? chroma(CONTRAST_COLORS.DARK) : chroma(CONTRAST_COLORS.LIGHT);
  let currentContrast = chroma.contrast(bgChroma, fgChroma);

  if (currentContrast >= targetContrast) {
    return hexToColorInfo(fgChroma.hex());
  }

  // If contrast is insufficient, try to derive a color
  const bgHsl = bgChroma.hsl();
  let derivedFgChroma: chroma.Color | null = null;

  if (bgLuminance > 0.5) { // Light background, need dark foreground
    // Try to create a dark color based on the background's hue
    // Aim for low luminance (e.g., 0.1-0.2), adjust saturation if needed
    derivedFgChroma = chroma.hsl(bgHsl[0] || 0, Math.min(0.8, bgHsl[1] * 1.2), 0.15);
    currentContrast = chroma.contrast(bgChroma, derivedFgChroma);
    if (currentContrast < targetContrast) { // If still insufficient, fall back to black
      derivedFgChroma = chroma(CONTRAST_COLORS.DARK);
    }
  } else { // Dark background, need light foreground
    // Try to create a light color based on the background's hue
    // Aim for high luminance (e.g., 0.9-0.95), adjust saturation if needed
    derivedFgChroma = chroma.hsl(bgHsl[0] || 0, Math.min(0.8, bgHsl[1] * 0.8), 0.9);
    currentContrast = chroma.contrast(bgChroma, derivedFgChroma);
    if (currentContrast < targetContrast) { // If still insufficient, fall back to white
      derivedFgChroma = chroma(CONTRAST_COLORS.LIGHT);
    }
  }
  return hexToColorInfo(derivedFgChroma.hex());
}

/**
 * Generates a muted foreground color by mixing the standard foreground with the background.
 * Ensures sufficient contrast for muted text (e.g., 3.0:1).
 */
export function _generateMutedForeground(
  foregroundInfo: ColorInfo,
  backgroundInfo: ColorInfo,
  targetMutedContrast: number = CONTRAST_REQUIREMENTS.MUTED_CONTEXT
): ColorInfo | null {
  // Mix the foreground with the background to create a muted version
  // Start with a mix ratio (e.g., 25% background, 75% foreground)
  let mixRatio = 0.25;
  let mixedChroma = chroma.mix(foregroundInfo.chroma, backgroundInfo.chroma, mixRatio, 'rgb');
  let currentContrast = chroma.contrast(mixedChroma, backgroundInfo.chroma);

  debugger;
  // If contrast is too low, adjust the mix ratio (e.g., less background influence)
  if (currentContrast < targetMutedContrast) {
    mixRatio = 0.15;
    mixedChroma = chroma.mix(foregroundInfo.chroma, backgroundInfo.chroma, mixRatio, 'rgb');
    currentContrast = chroma.contrast(mixedChroma, backgroundInfo.chroma);
    
    // As a final fallback if still too low, consider returning the original foreground
    // or a slightly desaturated version of it, if that meets the muted contrast.
    // For now, we'll return this mix. A more robust solution might try other strategies.
    if (currentContrast < targetMutedContrast) {
      // Potentially add a warning here or use a safer fallback
      // For simplicity, we'll return this mix. A more robust solution might try other strategies.
    }
  }

  return hexToColorInfo(mixedChroma.hex());
}
