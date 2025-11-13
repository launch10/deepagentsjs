import { Brainstorm, type PrimaryKeyType } from "../types";
import { type CoreGraphState } from "./core";
import { LanggraphData, type LanggraphUIMessage } from "langgraph-ai-sdk-types";
import type { Simplify } from "type-fest";

export type BrainstormGraphState = Simplify<CoreGraphState & {
    brainstormId: PrimaryKeyType | undefined;
    memories: Brainstorm.MemoriesType;
    qa: Brainstorm.QAResultType | undefined;
    currentTopic: Brainstorm.TopicType | undefined;
    placeholderText: string;
    availableActions: Brainstorm.ActionType[];
    selectedAction: Brainstorm.ActionType | undefined;
    remainingTopics: Brainstorm.TopicType[];
    redirect: Brainstorm.RedirectType | undefined;
}>

export type BrainstormLanggraphData = LanggraphData<
    BrainstormGraphState,
    typeof Brainstorm.questionSchema
>

// Clean, flattened message type for consumer use
export type BrainstormMessage = Simplify<LanggraphUIMessage<BrainstormLanggraphData>>;