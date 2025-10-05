import { z } from "zod";
import { primaryKeySchema, baseModelSchema } from "../core";

export const CssThemeVars = [
  '--accent', '--accent-foreground', '--accent-foreground-muted',
  '--background', '--background-foreground', '--background-foreground-muted',
  '--border', '--card', '--card-foreground', '--card-foreground-muted',
  '--destructive', '--destructive-foreground', '--destructive-foreground-muted',
  '--input', '--muted', '--muted-foreground', '--muted-foreground-muted',
  '--neutral-1', '--neutral-2', '--neutral-3',
  '--popover', '--popover-foreground', '--popover-foreground-muted',
  '--primary', '--primary-foreground', '--primary-foreground-muted',
  '--ring', '--ring-foreground', '--ring-foreground-muted',
  '--secondary', '--secondary-foreground', '--secondary-foreground-muted',
  '--success', '--success-foreground', '--success-foreground-muted',
  '--warning', '--warning-foreground', '--warning-foreground-muted',
  '--foreground'
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

export const themeSchema = baseModelSchema.extend({
  name: z.string().describe("The theme's human-readable name"),
  colors: z.array(hexadecimalColorSchema).describe("List of hexadecimal colors for this theme"),
  theme: cssThemeSchema.describe("List of CSS classes describing this theme"),
  createdAt: z.date().optional().describe("Date the theme was created"),
  updatedAt: z.date().optional().describe("Date the theme was last updated"),
});

export type ThemeType = z.infer<typeof themeSchema>;