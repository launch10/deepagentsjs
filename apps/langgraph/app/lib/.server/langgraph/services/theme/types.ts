// Input theme format from JSON
export interface InputTheme {
  colors: string[]; // Hex codes without # prefix
  labels?: string[]; // Optional descriptive tags
}

// Output theme format with CSS variables
export interface ThemeOutput {
  // Includes base, -foreground, and -foreground-muted for each semantic role
  [key: string]: string; // CSS variable name -> hex color code with # prefix
}

// Type for warnings during theme generation (FR9)
export type WarningType = 
  | 'contrast'        // Low contrast detected
  | 'default'         // Fallback to a default color
  | 'derivation'      // Issue during color derivation
  | 'muted_identical' // Muted color is identical to its foreground
  | 'internal';       // Internal processing error or unexpected state

// For warnings during theme generation
export interface ThemeWarning {
  type: WarningType;
  message: string;
  affectedVariables?: string[];
}

// Complete response including theme and any warnings
export interface ThemeResponse {
  theme: ThemeOutput;
  warnings?: ThemeWarning[];
}

// Error response for invalid inputs
export interface ErrorResponse {
  error: string;
  details?: string;
}

// Union type for the service response
export type ServiceResponse = ThemeResponse | ErrorResponse;

// Internal color representation for processing
export interface ColorInfo {
  hex: string;       // With # prefix
  luminance: number; // For sorting
  saturation: number; // For sorting
  // Consider importing Chroma type if possible, using 'any' for now
  chroma: any;       // chroma-js object 
}
