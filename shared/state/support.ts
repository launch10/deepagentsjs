import { type CoreGraphState } from "../types/graph";
import type { Simplify } from "type-fest";
import { type BridgeType } from "langgraph-ai-sdk-types";

export type SupportGraphState = Simplify<
  CoreGraphState & {
    faqContext: string | undefined;
  }
>;

export type SupportBridgeType = BridgeType<SupportGraphState>;
