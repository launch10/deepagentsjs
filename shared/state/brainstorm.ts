import { BrainstormAnnotation } from "../annotation";
import { Brainstorm } from "../types";
import { LanggraphData, type LanggraphUIMessage } from "langgraph-ai-sdk";
import type { Simplify } from "type-fest";

export type BrainstormGraphState = typeof BrainstormAnnotation.State;

export type BrainstormLanggraphData = LanggraphData<
    BrainstormGraphState,
    typeof Brainstorm.messageSchema
>

// Clean, flattened message type for consumer use
export type BrainstormMessage = Simplify<LanggraphUIMessage<BrainstormLanggraphData>>;