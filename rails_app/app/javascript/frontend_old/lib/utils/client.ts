import { Client } from "@langchain/langgraph-sdk";

export const createClient = (jwt: string | null) => {
  const deploymentUrl = import.meta.env.VITE_LANGGRAPH_API_URL;
  const langchainAPIKey = import.meta.env.VITE_LANGCHAIN_API_KEY;

  return new Client({
    apiUrl: deploymentUrl,
    defaultHeaders: {
      ...(langchainAPIKey && { "x-api-key": langchainAPIKey }),
      Authorization: `Bearer ${jwt}`,
    },
  });
};
