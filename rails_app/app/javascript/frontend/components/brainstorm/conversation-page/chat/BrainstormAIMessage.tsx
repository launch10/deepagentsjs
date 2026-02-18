import React from "react";
import type { MessageBlock, InferBridgeData } from "langgraph-ai-sdk-types";
import type { BrainstormBridgeType } from "@shared";
import { Chat } from "@components/shared/chat/Chat";

// The LanggraphData type for the Brainstorm graph (used for MessageBlock generic)
type BrainstormLanggraphData = InferBridgeData<BrainstormBridgeType>;

interface BrainstormMessageProps {
  blocks: MessageBlock<BrainstormLanggraphData>[];
  isActive?: boolean;
}

/**
 * Renders a brainstorm AI message as plain markdown.
 * Uses the generic Chat.BlockRenderer for text rendering.
 * Memoized to prevent unnecessary re-renders during streaming.
 */
export const BrainstormAIMessage = React.memo(function BrainstormMessage({
  blocks,
  isActive = true,
}: BrainstormMessageProps) {
  return (
    <Chat.AIMessage.Root>
      <Chat.BlockRenderer
        blocks={blocks}
        isActive={isActive}
      />
    </Chat.AIMessage.Root>
  );
});
