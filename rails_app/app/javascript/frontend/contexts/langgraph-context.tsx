import { createContext, useContext, useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { useLanggraph } from "langgraph-ai-sdk-react";
import type { AdsBridgeType } from "@shared";
import type { CampaignProps } from "@components/ad-campaign/ad-campaign.types";

type LanggraphReturnType = ReturnType<typeof useLanggraph<AdsBridgeType>>;

interface LanggraphContextType extends LanggraphReturnType {}

const LanggraphContext = createContext<LanggraphContextType | undefined>(undefined);

export const useLanggraphContext = () => {
  const context = useContext(LanggraphContext);
  if (!context) {
    throw new Error("useLanggraphContext must be used within LanggraphProvider");
  }
  return context;
};

interface LanggraphProviderProps {
  children: React.ReactNode;
}

export const LanggraphProvider = ({ children }: LanggraphProviderProps) => {
  const pageProps = usePage<CampaignProps>();
  const { thread_id, jwt, langgraph_path } = pageProps.props;

  const url = new URL("api/ads/stream", langgraph_path).toString();
  const langgraph = useLanggraph<AdsBridgeType>({
    api: url,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    getInitialThreadId: () => (thread_id ? thread_id : undefined),
  });

  console.log("LanggraphProvider", langgraph.state?.headlines?.map((h) => h?.text));
  const value = useMemo(() => langgraph, [langgraph]);

  return <LanggraphContext.Provider value={value}>{children}</LanggraphContext.Provider>;
};
