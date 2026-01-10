/**
 * Context available to the coding agent.
 */
export const contextPrompt = () => `
## Your Context

You have access to:
- **Brainstorm**: The user's idea, target audience, solution, and social proof
- **Theme**: 6 primary colors configured in tailwind.config.ts
- **Images**: Uploaded images including logos (from Cloudflare R2)
`;
