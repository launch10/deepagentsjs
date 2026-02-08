import { PromptTemplate } from "@langchain/core/prompts";
import { createScorer } from "./createScorer";

const template = PromptTemplate.fromTemplate(`
You are an expert UI/UX designer evaluating the quality of a generated landing page.
You are reviewing the raw React/TypeScript source code of the page.

[User Request]: {input}

[Landing Page Source Code]:
{output}

Evaluate the DESIGN QUALITY of this landing page based on these criteria:

1. **Visual Distinctiveness**: Does this look like a thoughtfully designed page or generic AI output?
   - Distinctive fonts (NOT Inter, Roboto, Arial, system fonts)?
   - Bold color usage (not timid, evenly-distributed palettes)?
   - Atmospheric elements (gradients, shadows, textures, overlays)?

2. **Visual Hierarchy & Rhythm**:
   - Hero section with large headlines (text-4xl+ or equivalent)?
   - Section backgrounds alternate (bg-primary, bg-muted, bg-background — not all the same)?
   - Cards have depth (shadows, rounded corners, contrast against their section)?

3. **Typography & Spacing**:
   - Clear headline > subheadline > body hierarchy?
   - Generous whitespace (py-16+ section padding, not cramped)?
   - Responsive sizing (md: and lg: breakpoints)?

4. **Interactivity & Polish**:
   - Hover effects on buttons and cards?
   - Smooth transitions (transition-all, duration-200+)?
   - Micro-interactions or animations?

5. **Memorability**:
   - Is there ONE distinctive thing someone would remember after 3 seconds?
   - Does the page have a clear aesthetic point-of-view?

Red flags (score lower if present):
- All sections have the same background color
- Headlines are small (text-xl or text-2xl)
- No hover effects anywhere
- Generic CTAs like "Get Started" with no context
- Using system/generic fonts

Available options:

{options}
`);

const choiceScores = {
  "exceptional design": 1,
  "strong design": 0.8,
  "competent design": 0.6,
  "mediocre design": 0.35,
  "poor design": 0.1,
};

export const DesignQualityScorer = createScorer({ prompt: template, choiceScores });
