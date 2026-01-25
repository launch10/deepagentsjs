/**
 * Ads API
 *
 * Bound graph API with automatic usage tracking.
 * Pass `context: { chatId }` in stream options for billing.
 *
 * @example
 * ```typescript
 * import { AdsAPI } from "@api";
 *
 * return AdsAPI.stream({
 *   messages,
 *   threadId,
 *   context: { chatId },
 *   state: { jwt: auth.jwt }
 * });
 * ```
 */
import { graphParams } from "@core";
import { adsGraph } from "@graphs";
import { AdsBridge } from "@bridges";

const compiledAdsGraph = adsGraph.compile({
  ...graphParams,
  name: "ads",
});

export const AdsAPI = AdsBridge.bind(compiledAdsGraph as any);
