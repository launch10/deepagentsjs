/**
 * Keyword-based edit classifier — replaces the LLM classifier to save one round-trip.
 *
 * SIMPLE: cosmetic tweaks the light agent can handle in 1-2 tool calls.
 * COMPLEX: structural changes, new functionality, bug reports → full coding agent.
 */

const COMPLEX_PATTERNS = [
  // Structural
  /\b(add|create|build|new)\b.*(section|page|component|form|modal|feature)/i,
  /\brestructur/i,
  /\bredesign/i,
  /\brefactor/i,
  // Bug / error reports
  /\b(bug|error|broken|not working|doesn't work|won't|can't|issue|fix|crash)/i,
  // Functionality
  /\b(functionality|interactive|animation|api|fetch|submit|validate|logic)/i,
  // Multi-file scope signals
  /\b(every|all)\b.*(section|page|component)/i,
  /\b(entire|whole)\b.*(page|site|website|layout)/i,
];

const SIMPLE_PATTERNS = [
  // Colors & theme
  /\b(color|colour|dark|light|bright|muted|shade|tint|hue|theme)/i,
  // Text / copy
  /\b(text|copy|headline|title|subtitle|heading|description|wording|label|slogan|tagline)/i,
  // Typography
  /\b(font|bold|italic|underline|uppercase|lowercase|size|bigger|smaller)/i,
  // Spacing & layout tweaks
  /\b(spacing|padding|margin|gap|align|center|left|right|narrow|wide)/i,
  // Visibility
  /\b(show|hide|remove|visible|invisible|toggle|display)/i,
  // Images
  /\b(image|photo|picture|icon|logo|swap|replace)\b/i,
  // Style tweaks
  /\b(style|tweak|adjust|change|update|make|scary|halloween|christmas|festive|modern|minimal|clean|sleek|professional|playful|fun|elegant)/i,
  // Specific component mentions (single component edits)
  /\b(hero|header|banner|footer|button|cta|call.to.action|card|badge|nav)/i,
  // Borders & effects
  /\b(border|shadow|rounded|gradient|opacity|blur|glow)/i,
  // Background
  /\b(background|bg)\b/i,
];

export function classifyEdit(userMessage: string): "simple" | "complex" {
  // Complex patterns take priority — if it smells complex, route to full agent
  if (COMPLEX_PATTERNS.some((p) => p.test(userMessage))) {
    // Exception: if the "add" is clearly about adding a simple style change,
    // don't mark as complex. e.g. "add a dark background" vs "add a new section"
    const isSimpleAdd = /\b(add|create)\b.*(color|background|shadow|border|gradient|padding|margin|style)/i.test(userMessage);
    if (isSimpleAdd) {
      return "simple";
    }
    return "complex";
  }

  if (SIMPLE_PATTERNS.some((p) => p.test(userMessage))) {
    return "simple";
  }

  // Default to complex when unsure — safer to overshoot than undershoot
  return "complex";
}
