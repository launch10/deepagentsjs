import { type CoreGraphState } from "../types/graph";
import { type BridgeType } from "langgraph-ai-sdk-types";

export type SupportGraphState = CoreGraphState;

export type SupportBridgeType = BridgeType<SupportGraphState>;
