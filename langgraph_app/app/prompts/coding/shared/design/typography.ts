/**
 * Typography recommendations prompt for the coding agent.
 * Theme data (including typography_recommendations) is seeded at the agent utils layer.
 */
import type {
  CodingPromptState,
  CodingPromptFn,
  TypographyRecommendations,
  TypographyCategory,
  TypographyRecommendation,
} from "../types";

/**
 * Format a single typography recommendation.
 */
function formatRecommendation(rec: TypographyRecommendation, palette?: string[]): string {
  const isPaletteColor = palette?.includes(rec.color);
  const styleNote = isPaletteColor ? "palette color" : "standard";
  return `    - #${rec.color} (${rec.contrast}:1 ${rec.level}) [${styleNote}]`;
}

/**
 * Format typography recommendations for a single background color.
 */
function formatBackgroundSection(
  bgColor: string,
  category: TypographyCategory,
  palette?: string[]
): string[] {
  const lines: string[] = [`On #${bgColor} background:`];

  if (category.headlines && category.headlines.length > 0) {
    lines.push("  Headlines (bold, attention-grabbing):");
    for (const rec of category.headlines) {
      lines.push(formatRecommendation(rec, palette));
    }
  }

  if (category.subheadlines && category.subheadlines.length > 0) {
    lines.push("  Subheadlines (visual variety):");
    for (const rec of category.subheadlines) {
      lines.push(`    - #${rec.color} (${rec.contrast}:1 ${rec.level})`);
    }
  }

  if (category.body && category.body.length > 0) {
    lines.push("  Body text (readable, clear):");
    for (const rec of category.body.slice(0, 2)) {
      lines.push(`    - #${rec.color} (${rec.contrast}:1 ${rec.level})`);
    }
  }

  lines.push("");
  return lines;
}

/**
 * Format typography recommendations as a prompt section.
 * Mirrors Rails ThemeConcerns::TypographyRecommendations.format_for_prompt
 */
export function formatTypographyPrompt(
  recommendations: TypographyRecommendations | undefined,
  colors?: string[]
): string {
  if (!recommendations || Object.keys(recommendations).length === 0) {
    return "";
  }

  const lines: string[] = ["## Typography Guide"];

  if (colors && colors.length > 0) {
    lines.push(`Palette: ${colors.map((c) => `#${c}`).join(", ")}`);
  }
  lines.push("");

  for (const [bgColor, category] of Object.entries(recommendations)) {
    lines.push(...formatBackgroundSection(bgColor, category, colors));
  }

  return lines.join("\n");
}

/**
 * Typography prompt for coding agent.
 * Uses typography_recommendations from state (seeded at agent utils layer).
 */
export const typographyPrompt: CodingPromptFn = async (
  state: CodingPromptState,
): Promise<string> => {
  if (!state.theme?.typography_recommendations) {
    return "";
  }

  return formatTypographyPrompt(state.theme.typography_recommendations, state.theme.colors);
};
