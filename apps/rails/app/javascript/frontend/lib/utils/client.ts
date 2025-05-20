import { Client } from "@langchain/langgraph-sdk";

export const createClient = () => {
  const deploymentUrl = import.meta.env.VITE_LANGGRAPH_API_URL;
  const langchainApiKey = import.meta.env.VITE_LANGCHAIN_API_KEY;

  return new Client({
    apiUrl: deploymentUrl,
    defaultHeaders: {
      ...(langchainApiKey && { "x-api-key": langchainApiKey }),
    },
  });
};
