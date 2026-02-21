/**
 * Font loading and responsive design patterns.
 * Ensures distinctive typography and mobile-first design.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const fontAndResponsivePrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Font Loading

**ALWAYS** load distinctive fonts from Google Fonts. Never rely on system fonts for headlines.

### Adding Google Fonts

In \`index.html\`, add the font link in the \`<head>\`:

\`\`\`html
<head>
  <!-- Preconnect for performance -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

  <!-- Load distinctive fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=General+Sans:wght@400;500;600&display=swap" rel="stylesheet">
</head>
\`\`\`

### Recommended Font Pairings

| Style | Headline Font | Body Font |
|-------|---------------|-----------|
| Modern Tech | Outfit | General Sans |
| Editorial | Playfair Display | Source Sans 3 |
| Bold Startup | Plus Jakarta Sans | Plus Jakarta Sans |
| Elegant | Instrument Serif | General Sans |
| Playful | Fraunces | IBM Plex Sans |
`;
