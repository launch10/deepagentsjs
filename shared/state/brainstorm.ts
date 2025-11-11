import { Brainstorm, type PrimaryKeyType } from "../types";
import { type CoreGraphState } from "./core";
import { LanggraphData, type LanggraphUIMessage } from "langgraph-ai-sdk-types";
import type { Simplify } from "type-fest";

export type BrainstormGraphState = Simplify<CoreGraphState & {
    brainstormId: PrimaryKeyType | undefined;
    memories: Brainstorm.Memories;
    availableActions: Brainstorm.Action[];
    selectedAction: Brainstorm.Action | undefined;
    remainingTopics: Brainstorm.Topic[];
}>

export type BrainstormLanggraphData = LanggraphData<
    BrainstormGraphState,
    typeof Brainstorm.messageSchema
>

// Clean, flattened message type for consumer use
export type BrainstormMessage = Simplify<LanggraphUIMessage<BrainstormLanggraphData>>;