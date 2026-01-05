import { Fragment, type ReactNode } from "react";
import type { TextMessageBlock } from "langgraph-ai-sdk-types";
import { AIMessage } from "./AIMessage";

// ============================================================================
// BlockRenderer Component
// ============================================================================
// Generic block dispatcher for rendering AI message blocks.
// Handles common block types (text, tool_call) and allows custom renderers
// for structured data.
//
// Example:
//   <Chat.BlockRenderer
//     blocks={message.blocks}
//     isActive={isLastMessage}
//     renderStructured={(data, isActive) => (
//       <MyCustomStructuredRenderer data={data} isActive={isActive} />
//     )}
//   />
// ============================================================================

// Use a minimal block interface to avoid coupling to specific LanggraphData types
interface MinimalBlock {
  id: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  text?: string;
}

export interface BlockRendererProps<TData = unknown> {
  /** The blocks to render */
  blocks: MinimalBlock[];
  /** Whether this message is "active" (affects text styling) */
  isActive?: boolean;
  /** Custom renderer for structured blocks */
  renderStructured?: (data: TData, isActive: boolean) => ReactNode;
  /** Additional className for the container */
  className?: string;
}

/**
 * Generic block renderer that dispatches to appropriate renderers by block type.
 *
 * Handles:
 * - text blocks: Renders as markdown via AIMessage.Content
 * - structured blocks: Delegates to renderStructured prop
 * - tool_call blocks: Hidden (runs silently in background)
 * - Other block types: Skipped
 */
export function BlockRenderer<TData = unknown>({
  blocks,
  isActive = true,
  renderStructured,
  className,
}: BlockRendererProps<TData>) {
  return (
    <div className={className}>
      {blocks.map((block) => {
        switch (block.type) {
          case "text": {
            const textBlock = block as TextMessageBlock;
            // Skip empty text blocks
            if (!textBlock.text || textBlock.text.trim() === "") {
              return null;
            }
            return (
              <AIMessage.Content
                key={block.id}
                state={isActive ? "active" : "inactive"}
              >
                {textBlock.text}
              </AIMessage.Content>
            );
          }

          case "structured": {
            if (!renderStructured) {
              // No custom renderer provided, skip structured blocks
              return null;
            }
            const data = block.data as TData;
            if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
              return null;
            }
            return (
              <Fragment key={block.id}>
                {renderStructured(data, isActive)}
              </Fragment>
            );
          }

          case "tool_call":
            // Tool calls are hidden - they run silently in the background
            return null;

          default:
            // Skip unknown block types
            return null;
        }
      })}
    </div>
  );
}
