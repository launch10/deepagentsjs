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
`;
