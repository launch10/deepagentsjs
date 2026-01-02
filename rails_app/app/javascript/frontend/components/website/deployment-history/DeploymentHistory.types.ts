export interface Deployment {
  id: string;
  status: "success" | "failed" | "pending";
  isNew?: boolean;
  isLive?: boolean;
  timestamp: string;
  adGroupName?: string;
  url?: string;
  errorMessage?: string;
}
