import { Brainstorm, type UUIDType, type PrimaryKeyType } from "../types";
import { type CoreGraphState } from "../types/graph";
import type { Simplify } from "type-fest";
import { type BridgeType } from "langgraph-ai-sdk-types";

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
    /** IDs of uploads to include with the current message (single-message scope) */
    uploadIds: number[];
}>

export type BrainstormBridgeType = BridgeType<
    BrainstormGraphState,
    typeof Brainstorm.structuredMessageSchemas
>