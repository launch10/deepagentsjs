import { Brainstorm, type UUIDType, type PrimaryKeyType } from "../types";
import { type CoreGraphState } from "../types/graph";
import type { Simplify } from "type-fest";
import { type BridgeType } from "langgraph-ai-sdk-types";

/**
 * Mode type for tracking brainstorm state across turns.
 * Used to detect mode switches for context message injection.
 */
export type BrainstormModeType = "default" | "helpMe" | "doTheRest" | "uiGuidance" | "finishSkipped";

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
    /**
     * Tracks the brainstorm mode across turns for context message injection.
     * Used to detect mode switches (e.g., default → helpMe, conversational → uiGuidance).
     */
    brainstormMode: BrainstormModeType | undefined;
}>

export type BrainstormBridgeType = BridgeType<
    BrainstormGraphState,
    typeof Brainstorm.structuredMessageSchemas
>