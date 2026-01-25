import { Brainstorm } from "@types";
import { BrainstormAnnotation } from "@annotation";
import { createAppBridge } from "./factory";

// Bridge from Langgraph -> the AI SDK (streaming frontend)
// Uses createAppBridge for automatic usage tracking
export const BrainstormBridge = createAppBridge({
  endpoint: "/api/brainstorm/stream",
  stateAnnotation: BrainstormAnnotation,
  messageSchema: Brainstorm.structuredMessageSchemas,
  jsonTarget: "messages",
});
