import type { WebsiteGraphState} from '@shared/state/graph';
import stringify from "fast-json-stable-stringify";

// TODO: MOVE TO PROMPTS!!!
export const indexCssPrompt = async (state: GraphState) => {
  const template = `
  Your task is to generate the content for an index.css file that defines the core theme using CSS variables based on the provided color theme. This file is the single source of truth for color values and contrast pairings, designed for use with Tailwind CSS and Shadcn UI conventions.

  Input Theme (Hex Codes):
  ${stringify(state.app.project?.projectPlan?.theme)}

  Core Requirements:

  1.  **File Structure:** Start with @tailwind base; @tailwind components; @tailwind utilities;. Define all variables within @layer base { :root { ... } } for light mode and @layer base { .dark { ... } } for dark mode.
  2.  **Variable Naming:** Use Shadcn UI conventional variable names (e.g., --background, --foreground, --primary, --primary-foreground, --card, --card-foreground, --muted, --muted-foreground, etc.).
  3.  **HSL Format:** Convert ALL hex codes from the input theme to HSL format (e.g., 217 91% 60%) for the CSS variable values. Do NOT include 'hsl()' or commas within the variable value itself.
  4.  **Semantic Role Mapping:** Map the input theme colors to the appropriate semantic CSS variables. Make sensible choices:
      *   --background: Use theme.background.
      *   --primary: Use theme.primary.
      *   --secondary: Use theme.secondary.
      *   --muted: Use theme.muted.
      *   --accent: Use theme.accent.
      *   --success: Use theme.success.
      *   --warning: Use theme.warning.
      *   --error: Use theme.error (map to --destructive).
      *   --border, --input: Use theme.neutral1 or derive a subtle variant from background/muted.
      *   --ring: Often related to primary, but can be theme.neutral2 or similar.
      *   --card, --popover: Often the same as --background but can be different (e.g., pure white/black or slightly offset). Use theme.background as a default if unsure.
      *   --neutral1, --neutral2, --neutral3: Map directly if provided in the theme.
  5.  **CRITICAL - Foreground Generation & Contrast Enforcement:**
      *   For **EVERY** background-like variable (--background, --card, --popover, --primary, --secondary, --muted, --accent, --destructive), you MUST define a corresponding -foreground variable (e.g., --primary-foreground, --card-foreground).
      *   **Choose/generate an HSL value for each -foreground variable that ensures a minimum WCAG AA contrast ratio of 4.5:1 against its corresponding background variable.** (e.g., --primary-foreground must contrast 4.5:1 with --primary).
          *   *Guidance:* For dark backgrounds, try light foregrounds (e.g., HSL(0 0% 98%) / near-white). For light backgrounds, try dark foregrounds (e.g., HSL(0 0% 3.9%) / near-black). Always verify the contrast ratio.
      *   **Special Case (--muted-foreground):** Ensure --muted-foreground not only contrasts sufficiently (4.5:1) with --muted, but ALSO achieves at least **3:1 contrast** (WCAG AA for large text) against --background AND --card. This provides flexibility while preventing the severe legibility issues seen before. If achieving 3:1 against background/card is impossible while maintaining 4.5:1 against muted, prioritize the muted contrast and make a note /* Muted-foreground may have low contrast on main background */.
      *   --foreground is the partner to --background. Ensure this pair meets 4.5:1 contrast.
  6.  **Dark Mode:** Define all variables again within .dark { ... }.
      *   Typically, --background and --foreground swap (or use dark/light equivalents).
      *   Recalculate/choose -foreground variables for --primary, --secondary, etc., to ensure they contrast correctly with their respective backgrounds *in dark mode*. Often, the light mode -foreground (like white text on a blue button) works in dark mode too, but verify.
      *   Ensure --muted-foreground rules are also met in dark mode.
  7.  **Radius:** Define --radius: 0.75rem; (or another sensible default) in :root.
  8.  **Base Body Styles:** Include the basic body styles:
      css
      @layer base {
        * { @apply border-border; }
        body { @apply bg-background text-foreground; font-feature-settings: "rlig" 1, "calt" 1; }
      }
      

  Output ONLY the CSS code content.
  `;

  return template;
}