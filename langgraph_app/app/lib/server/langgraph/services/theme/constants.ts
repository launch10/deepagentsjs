// Predefined contrast colors (FR6)
export const CONTRAST_COLORS = {
  LIGHT: '#FAFAFA',
  DARK: '#0A0A0A'
};

// Default Neutral Colors
export const DEFAULT_NEUTRAL_COLORS = {
  WHITE: '#FFFFFF',
  OFF_WHITE: '#F8F9FA', // A common off-white shade
  LIGHT_GRAY: '#E9ECEF'  // A common light gray shade
};

export const DEFAULT_LIGHT_GRAY_HEX = DEFAULT_NEUTRAL_COLORS.LIGHT_GRAY;

// Default Fallback Brand Colors
export const DEFAULT_FALLBACK_BRAND_COLORS = {
  PRIMARY: '#007BFF',    // A generic blue
  SECONDARY: '#6C757D',  // A generic gray
  ACCENT: '#17A2B8'       // A generic teal/cyan
};

// Default status colors (FR5)
export const DEFAULT_STATUS_COLORS = {
  DESTRUCTIVE: '#dc3545', // Bootstrap Red
  WARNING: '#ffc107',     // Bootstrap Yellow
  SUCCESS: '#198754'      // Bootstrap Green
};

// Brand Color Selection Parameters
export const MIN_SATURATION_FOR_BRAND_COLORS = 0.35;
export const TARGET_LUMINANCE_PRIMARY = 0.4;
export const TARGET_LUMINANCE_SECONDARY = 0.6;
export const TARGET_LUMINANCE_ACCENT = 0.5;
export const MIN_CONTRAST_RATIO_BETWEEN_BRAND_COLORS = 1.5;

// Required CSS variable names (FR2)
export const CSS_VARIABLES = {
  // Base variables
  BACKGROUND: '--background',
  FOREGROUND: '--foreground',
  PRIMARY: '--primary',
  PRIMARY_FOREGROUND: '--primary-foreground',
  SECONDARY: '--secondary',
  SECONDARY_FOREGROUND: '--secondary-foreground',
  MUTED: '--muted',
  MUTED_FOREGROUND: '--muted-foreground',
  ACCENT: '--accent',
  ACCENT_FOREGROUND: '--accent-foreground',
  
  // Status variables
  DESTRUCTIVE: '--destructive',
  DESTRUCTIVE_FOREGROUND: '--destructive-foreground',
  SUCCESS: '--success',
  SUCCESS_FOREGROUND: '--success-foreground',
  WARNING: '--warning',
  WARNING_FOREGROUND: '--warning-foreground',
  
  // UI element variables
  CARD: '--card',
  CARD_FOREGROUND: '--card-foreground',
  POPOVER: '--popover',
  POPOVER_FOREGROUND: '--popover-foreground',
  BORDER: '--border',
  INPUT: '--input',
  RING: '--ring',
  
  // Neutral shades
  NEUTRAL_1: '--neutral-1',
  NEUTRAL_2: '--neutral-2',
  NEUTRAL_3: '--neutral-3'
};

// Typical hue ranges for status colors (degrees)
export const STATUS_HUE_RANGES = {
  DESTRUCTIVE: { min: 345, max: 15 },  // Red/Pink (wraps around 0/360)
  WARNING: { min: 15, max: 65 },       // Yellow/Orange
  SUCCESS: { min: 65, max: 170 }       // Green/Cyan
};

// Contrast requirements
export const CONTRAST_REQUIREMENTS = {
  STANDARD: 4.5,  // WCAG AA for normal text
  MUTED_CONTEXT: 3.0  // Additional requirement for muted text
};
