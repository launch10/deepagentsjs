import type {
  MessageBlock,
  TextMessageBlock,
  StructuredMessageBlock,
  ToolCallMessageBlock,
} from "langgraph-ai-sdk-types";
import type { BrainstormBridgeType, InferBridgeData } from "@shared";
import { Chat } from "@components/chat";

type BrainstormData = InferBridgeData<BrainstormBridgeType>;

interface BrainstormMessageProps {
  blocks: MessageBlock<BrainstormData>[];
  isActive?: boolean;
  onExampleClick?: (text: string) => void;
}

/**
 * Renders a brainstorm AI message with support for:
 * - Text blocks (markdown)
 * - Structured blocks (reply/helpMe with examples)
 * - Tool call indicators
 */
export function BrainstormMessage({
  blocks,
  isActive = true,
  onExampleClick,
}: BrainstormMessageProps) {
  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          isActive={isActive}
          onExampleClick={onExampleClick}
        />
      ))}
    </div>
  );
}

interface BlockRendererProps {
  block: MessageBlock<BrainstormData>;
  isActive: boolean;
  onExampleClick?: (text: string) => void;
}

function BlockRenderer({ block, isActive, onExampleClick }: BlockRendererProps) {
  switch (block.type) {
    case "text": {
      const textBlock = block as TextMessageBlock;
      if (!textBlock.text || textBlock.text.trim() === "") {
        return null;
      }
      return (
        <Chat.AIMessage.Content state={isActive ? "active" : "inactive"}>
          {textBlock.text}
        </Chat.AIMessage.Content>
      );
    }

    case "structured": {
      const structuredBlock = block as StructuredMessageBlock<BrainstormData>;
      const data = structuredBlock.data;

      if (!data || Object.keys(data).length === 0) {
        return null;
      }

      return (
        <StructuredBlockRenderer data={data} isActive={isActive} onExampleClick={onExampleClick} />
      );
    }

    case "tool_call": {
      const toolBlock = block as ToolCallMessageBlock;
      return (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <div
            className={`w-2 h-2 rounded-full ${
              toolBlock.state === "complete"
                ? "bg-success-500"
                : toolBlock.state === "error"
                  ? "bg-red-500"
                  : "bg-yellow-500 animate-pulse"
            }`}
          />
          <span>{toolBlock.toolName}</span>
        </div>
      );
    }

    default:
      return null;
  }
}

interface StructuredBlockRendererProps {
  data: BrainstormData;
  isActive: boolean;
  onExampleClick?: (text: string) => void;
}

function StructuredBlockRenderer({ data, isActive, onExampleClick }: StructuredBlockRendererProps) {
  if (data.type === "reply" || data.type === "helpMe") {
    return (
      <div className="space-y-3">
        {"text" in data && data.text && (
          <Chat.AIMessage.Content state={isActive ? "active" : "inactive"}>
            {String(data.text)}
          </Chat.AIMessage.Content>
        )}

        {"examples" in data && Array.isArray(data.examples) && data.examples.length > 0 && (
          <div className="space-y-2 mt-3">
            <div className="text-xs font-medium text-neutral-500">Example answers:</div>
            {data.examples.map((example: unknown, i: number) => (
              <button
                key={i}
                type="button"
                onClick={() => onExampleClick?.(String(example))}
                className="w-full text-left p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-sm hover:bg-neutral-100 transition-colors"
              >
                <div className="font-medium text-primary-600 text-xs mb-1">Example {i + 1}</div>
                <div className="text-neutral-700">{String(example)}</div>
              </button>
            ))}
          </div>
        )}

        {"conclusion" in data && data.conclusion && (
          <div className="mt-3 pt-3 border-t border-neutral-200">
            <Chat.AIMessage.Content state={isActive ? "active" : "inactive"}>
              {String(data.conclusion)}
            </Chat.AIMessage.Content>
          </div>
        )}

        {"template" in data && data.template && (
          <div className="mt-3 pt-3 border-t border-neutral-200">
            <div className="text-xs font-medium text-neutral-500 mb-2">Template:</div>
            <Chat.AIMessage.Content state={isActive ? "active" : "inactive"}>
              {String(data.template)}
            </Chat.AIMessage.Content>
          </div>
        )}
      </div>
    );
  }

  return null;
}
