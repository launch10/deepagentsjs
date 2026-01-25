import { WebsiteAnnotation } from "@annotation";
import { createAppBridge } from "./factory";

// Bridge from Langgraph -> the AI SDK (streaming frontend)
// Uses createAppBridge for automatic usage tracking
export const WebsiteBridge = createAppBridge({
  endpoint: "/api/website/stream",
  stateAnnotation: WebsiteAnnotation,
});
