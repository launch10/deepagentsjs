/**
 * Component guidelines for landing page development.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const fileStructurePrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## File Guidelines

The following components are typical for a landing page:

/src
    /pages
        /IndexPage.tsx (required)
        /PricingPage.tsx (optional)
        /ContactPage.tsx (optional)
        /AboutPage.tsx (optional)
    /components
        /Header.tsx (required)
        /Footer.tsx (required)
        /Hero.tsx (required)
        /Features.tsx (optional)
        /Pricing.tsx (optional)
        /SocialProof.tsx (optional)
        /CTA.tsx (optional)

### Infrastructure files (DO NOT modify)
These handle prerendering and bootstrapping deployed websites:
- /src/main.tsx
- /src/entry-server.tsx
- /scripts/prerender.js
`;
