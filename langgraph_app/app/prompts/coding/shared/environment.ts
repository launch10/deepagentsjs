/**
 * Environment variables available to generated landing pages.
 */
export const environmentPrompt = () => `
## Available Environment Variables

Your generated code can use these Vite environment variables (available via \`import.meta.env\`):

- \`VITE_API_BASE_URL\` - Base URL for API calls (e.g., lead capture). Use for fetch calls to the backend.
- \`VITE_SIGNUP_TOKEN\` - Project-specific token for authenticating lead capture API calls.
- \`VITE_GOOGLE_ADS_ID\` - Google Ads ID for conversion tracking (used by L10 analytics library).

Example usage for email signup forms:
\`\`\`typescript
const handleSubmit = async (email: string) => {
  const response = await fetch(\`\${import.meta.env.VITE_API_BASE_URL}/api/v1/leads\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      token: import.meta.env.VITE_SIGNUP_TOKEN
    })
  });
  // Handle response...
};
\`\`\`
`;
