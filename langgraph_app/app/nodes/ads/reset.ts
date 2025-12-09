import { NodeMiddleware } from "@middleware";
import type { AdsGraphState } from "@state";

export const resetNode = NodeMiddleware.use({}, async (state: AdsGraphState, config?: any) => {
  return {
    refresh: undefined, // reset refresh state
  };
});
