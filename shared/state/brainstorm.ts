import { Brainstorm, type PrimaryKeyType } from "../types";
import { type CoreGraphState } from "./core";
import { LanggraphData, type LanggraphUIMessage } from "langgraph-ai-sdk-types";
import type { Simplify } from "type-fest";

export type BrainstormGraphState = Simplify<CoreGraphState & {
    brainstormId: PrimaryKeyType | undefined;
    memories: Brainstorm.MemoriesType;
    currentTopic: Brainstorm.TopicType | undefined;
    skippedTopics: Brainstorm.TopicType[];
    placeholderText: string;
    availableCommands: Brainstorm.CommandType[];
    command: Brainstorm.CommandType | undefined;
    remainingTopics: Brainstorm.TopicType[];
    redirect: Brainstorm.RedirectType | undefined;
}>

export type BrainstormLanggraphData = LanggraphData<
    BrainstormGraphState,
    typeof Brainstorm.questionSchema
>

// Clean, flattened message type for consumer use
export type BrainstormMessage = Simplify<LanggraphUIMessage<BrainstormLanggraphData>>;