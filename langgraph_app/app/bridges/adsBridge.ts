import { Ads } from "@types";
import { AdsAnnotation } from "@annotation";
import { createAppBridge } from "./factory";

// Bridge from Langgraph -> the AI SDK (streaming frontend)
// Uses createAppBridge for automatic usage tracking
export const AdsBridge = createAppBridge({
  endpoint: "/api/ads/stream",
  stateAnnotation: AdsAnnotation as any,
  messageSchema: Ads.jsonSchema,
  jsonTarget: "state",
  transforms: Ads.StreamingTransforms,
});
