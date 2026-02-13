import type { CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { CodingPromptState } from "./types";

export const linksPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
    ## Navigation Patterns

    For in-page navigation (anchor links):

    - Use <a href="#section-id"> with matching id on target element
    - Example: <a href="#features"> links to <section id="features">

    For multi-page navigation (if needed):

    - Use React Router's Link component: <Link to="/about">
    - Define routes in src/App.tsx

    ## Footer Guidelines

    CRITICAL: The footer must ONLY contain links to sections that actually exist on the page.

    DO:
    - Link to page sections using anchor links (e.g. #features, #pricing) — but ONLY sections you are actually building
    - Include a logo or brand name
    - Include a copyright line (e.g. © 2025 Company Name)

    DO NOT:
    - Invent links to pages that don't exist (About, Blog, Careers, Contact, Privacy Policy, Terms of Service, etc.)
    - Add fake social media links (Twitter, LinkedIn, Facebook, etc.) unless the user provided real social URLs
    - Add fake addresses, phone numbers, or email addresses
    - Add "standard footer content" — if the user didn't provide it, don't invent it

    A minimal, honest footer is far better than one full of dead links. When in doubt, leave it out.
`;
