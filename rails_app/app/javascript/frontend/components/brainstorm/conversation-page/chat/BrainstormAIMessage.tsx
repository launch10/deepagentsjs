import React from "react";
import type { MessageBlock, InferBridgeData, InferMessage } from "langgraph-ai-sdk-types";
import type { BrainstormBridgeType } from "@shared";
import { Chat } from "@components/shared/chat/Chat";

// The LanggraphData type for the Brainstorm graph (used for MessageBlock generic)
type BrainstormLanggraphData = InferBridgeData<BrainstormBridgeType>;

// The actual structured message data type (reply | helpMe)
type BrainstormMessageData = InferMessage<BrainstormLanggraphData>;

interface BrainstormMessageProps {
  blocks: MessageBlock<BrainstormLanggraphData>[];
  isActive?: boolean;
  onExampleClick?: (text: string) => void;
}

/**
 * Renders a brainstorm AI message with support for:
 * - Text blocks (markdown)
 * - Structured blocks (reply/helpMe with examples)
 * - Tool call indicators (hidden)
 *
 * Uses the generic Chat.BlockRenderer with a custom structured renderer.
 * Memoized to prevent unnecessary re-renders during streaming.
 */
export const BrainstormAIMessage = React.memo(function BrainstormMessage({
  blocks,
  isActive = true,
  onExampleClick,
}: BrainstormMessageProps) {
  return (
    <Chat.AIMessage.Root>
      <Chat.BlockRenderer
        blocks={blocks}
        isActive={isActive}
        renderStructured={(data: BrainstormMessageData, active: boolean) => (
          <BrainstormStructuredRenderer
            data={data}
            isActive={active}
            onExampleClick={onExampleClick}
          />
        )}
      />
    </Chat.AIMessage.Root>
  );
});

interface BrainstormStructuredRendererProps {
  data: BrainstormMessageData;
  isActive: boolean;
  onExampleClick?: (text: string) => void;
}

/**
 * Brainstorm-specific structured block renderer.
 * Handles reply and helpMe message types with text, examples, conclusion, and template.
 */
function BrainstormStructuredRenderer({
  data,
  isActive,
  onExampleClick,
}: BrainstormStructuredRendererProps) {
  if (data.type !== "reply" && data.type !== "helpMe") {
    return null;
  }

  const state = isActive ? "active" : "inactive";

  return (
    <div className="space-y-3">
      {/* Main text content */}
      {"text" in data && data.text && (
        <Chat.AIMessage.Content state={state}>{data.text}</Chat.AIMessage.Content>
      )}

      {/* Example suggestions */}
      {"examples" in data && Array.isArray(data.examples) && data.examples.length > 0 && (
        <Chat.Suggestions.Root label="Example answers:">
          {data.examples.map((example, i) => (
            <Chat.Suggestions.Item key={i} index={i} onClick={() => onExampleClick?.(example)}>
              {example}
            </Chat.Suggestions.Item>
          ))}
        </Chat.Suggestions.Root>
      )}

      {/* Conclusion text */}
      {"conclusion" in data && data.conclusion && (
        <div className="mt-3 pt-3 border-t border-neutral-200">
          <Chat.AIMessage.Content state={state}>{data.conclusion}</Chat.AIMessage.Content>
        </div>
      )}

      {/* Template text */}
      {"template" in data && data.template && (
        <div className="mt-3 pt-3 border-t border-neutral-200">
          <div className="text-xs font-medium text-neutral-500 mb-2">Template:</div>
          <Chat.AIMessage.Content state={state}>{data.template}</Chat.AIMessage.Content>
        </div>
      )}
    </div>
  );
}
