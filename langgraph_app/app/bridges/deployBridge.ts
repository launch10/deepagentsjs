import { DeployAnnotation } from "@annotation";
import { createAppBridge } from "./factory";

// Bridge from Langgraph -> the AI SDK (streaming frontend)
// Uses createAppBridge for automatic usage tracking
// Note: Deploy streams state updates, not chat messages, so no messageSchema needed
export const DeployBridge = createAppBridge({
  endpoint: "/api/deploy/stream",
  stateAnnotation: DeployAnnotation,
});
