import { z } from "zod";
import { primaryKeySchema, baseModelSchema } from "../core";

// shadcn standard CSS variables
export const CssThemeVars = [
  // Core
  '--background', '--foreground',
  // Surfaces
  '--card', '--card-foreground',
  '--popover', '--popover-foreground',
  // Actions
  '--primary', '--primary-foreground',
  '--secondary', '--secondary-foreground',
  '--muted', '--muted-foreground',
  '--accent', '--accent-foreground',
  '--destructive', '--destructive-foreground',
  // UI elements
  '--border', '--input', '--ring',
  // L10 extensions
  '--warning', '--warning-foreground',
  '--success', '--success-foreground',
] as const;

// Create the Zod enum from the array
export const cssThemeVarSchema = z.enum(CssThemeVars);

// Infer the TypeScript union type from the Zod schema
export type CssThemeVarType = z.infer<typeof cssThemeVarSchema>;

// HSL value validation with regex
export const hslValueSchema = z.string().regex(
  /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/,
  "Must be a valid HSL color format like 'hsl(0, 0%, 100%)'"
);

// Create the theme colors schema as a record
export const cssThemeSchema = z.record(cssThemeVarSchema, hslValueSchema);
export type CssThemeType = z.infer<typeof cssThemeSchema>;

export const hexadecimalColorSchema = z.string().regex(
  /^(?:[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  "Must be a valid hexadecimal color format like 'FFFFFF' or 'FFF'"
);
export type HexadecimalColorType = z.infer<typeof hexadecimalColorSchema>;

// Typography recommendation for a single color pairing
export const typographyRecommendationSchema = z.object({
  color: z.string().describe("Hex color code (e.g., '264653')"),
  contrast: z.number().describe("Contrast ratio (e.g., 12.5)"),
  level: z.enum(["AAA", "AA", "AA-large", "fail"]).describe("WCAG compliance level"),
  style: z.string().describe("Style hint: 'bold', 'clear', 'palette', 'accent'"),
  note: z.string().optional().describe("Additional guidance"),
});
export type TypographyRecommendationType = z.infer<typeof typographyRecommendationSchema>;

// Typography recommendations for one background color
export const typographyCategorySchema = z.object({
  headlines: z.array(typographyRecommendationSchema).describe("Headline color options"),
  subheadlines: z.array(typographyRecommendationSchema).describe("Subheadline color options"),
  body: z.array(typographyRecommendationSchema).describe("Body text color options"),
  accents: z.array(typographyRecommendationSchema).describe("Accent color options"),
});
export type TypographyCategoryType = z.infer<typeof typographyCategorySchema>;

// Full typography recommendations keyed by background color
export const typographyRecommendationsSchema = z.record(
  z.string(), // Background color hex
  typographyCategorySchema
);
export type TypographyRecommendationsType = z.infer<typeof typographyRecommendationsSchema>;

export const themeSchema = baseModelSchema.extend({
  name: z.string().describe("The theme's human-readable name"),
  colors: z.array(hexadecimalColorSchema).describe("List of hexadecimal colors for this theme"),
  theme: cssThemeSchema.describe("CSS variables for this theme"),
  typographyRecommendations: typographyRecommendationsSchema.optional().describe("Typography guidance per background"),
  createdAt: z.date().optional().describe("Date the theme was created"),
  updatedAt: z.date().optional().describe("Date the theme was last updated"),
});

export type ThemeType = z.infer<typeof themeSchema>;