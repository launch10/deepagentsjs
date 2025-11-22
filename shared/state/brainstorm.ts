import { Brainstorm, type UUIDType, type PrimaryKeyType } from "../types";
import { type CoreGraphState } from "../types/graph";
import { type LanggraphData, type LanggraphUIMessage } from "langgraph-ai-sdk-types";
import type { Simplify } from "type-fest";

export type BrainstormGraphState = Simplify<CoreGraphState & {
    brainstormId: PrimaryKeyType | undefined;
    projectUUID: UUIDType;
    memories: Brainstorm.MemoriesType;
    currentTopic: Brainstorm.TopicName | undefined;
    skippedTopics: Brainstorm.TopicName[];
    placeholderText: string;
    availableCommands: Brainstorm.CommandName[];
    command: Brainstorm.CommandName | undefined;
    remainingTopics: Brainstorm.TopicName[];
    redirect: Brainstorm.RedirectType | undefined;
}>

export type BrainstormLanggraphData = LanggraphData<
    BrainstormGraphState,
    typeof Brainstorm.structuredMessageSchemas
>

// Clean, flattened message type for consumer use
export type BrainstormMessage = Simplify<LanggraphUIMessage<BrainstormLanggraphData>>;