import { InputTheme, ErrorResponse } from '../services/themeTypes';

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
