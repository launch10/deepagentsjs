/**
 * Design philosophy prompt - bold aesthetic direction for landing pages.
 * Distilled from the frontend-design skill into the most impactful guidance.
 * Lives in the static/cached prompt prefix (free after first call).
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const designPhilosophyPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Design Philosophy

Every landing page must have a **bold, intentional aesthetic direction**. Not safe. Not forgettable. Not generic.

### Before Building, Commit to a Direction

Pick a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is **intentionality, not intensity**.

Ask: What's the ONE memorable thing about this page? A distinctive hero treatment, an unusual layout choice, a creative use of color — something someone remembers after 3 seconds.

### Typography

Choose fonts that are distinctive and characterful. Pair a bold display font with a refined body font. NEVER default to generic system fonts (Inter, Roboto, Arial). Every page should feel like it has its own typographic personality.

### Spatial Composition

Break the expected. Use asymmetry, overlap, diagonal flow, grid-breaking elements. Generous negative space OR controlled density — both create visual interest. Avoid the predictable centered-text-with-even-grid layout.

### Motion & Atmosphere

Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggered animations and hover states that surprise.

Create atmosphere with gradient meshes, noise textures, layered transparencies, dramatic shadows, or decorative elements — not just flat solid-color sections.

### Anti-Slop Rules

NEVER produce generic AI aesthetics:
- Overused fonts (Inter, Roboto, system fonts)
- Purple-gradient-on-white cliches
- Perfectly symmetrical grids with identical cards
- Cookie-cutter component patterns
- Predictable layouts that look like every other AI-generated page

Every page should feel genuinely designed for its specific business context. Vary between light and dark themes, different font choices, different aesthetic approaches. No two pages should look the same.
`;
