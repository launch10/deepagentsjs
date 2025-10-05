import chroma from 'chroma-js';

export class HexToCssHslService {
  public execute(hex: string): string {
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
}