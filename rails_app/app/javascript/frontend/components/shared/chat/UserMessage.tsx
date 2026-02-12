import { twMerge } from "tailwind-merge";
import type { ReactNode } from "react";
import type { ImageMessageBlock, FileMessageBlock } from "langgraph-ai-sdk-types";
import { MessageImages, MessageDocuments } from "./attachments";

// ============================================================================
// UserMessage Component
// ============================================================================
// Renders a user message bubble. Can be used in two ways:
//
// Simple (backwards compatible):
//   <Chat.UserMessage>Hello world</Chat.UserMessage>
//
// Blocks-based (handles text + images automatically):
//   <Chat.UserMessage blocks={message.blocks} />
// ============================================================================

// Minimal block interface to avoid coupling to specific LanggraphData types
interface MinimalBlock {
  type: string;
  id: string;
  text?: string;
  url?: string;
  mimeType?: string;
}

/**
 * Props for UserMessage component.
 * Can be used with either children (simple text) or blocks (extracts text + images + files).
 */
export interface UserMessageProps {
  /** Simple text content (mutually exclusive with blocks) */
  children?: ReactNode;
  /** Message blocks to render (mutually exclusive with children) */
  blocks?: MinimalBlock[];
  /** Additional className */
  className?: string;
}

// Keep the specific types for documentation
export type UserMessageSimpleProps = Omit<UserMessageProps, "blocks"> & { children: ReactNode };
export type UserMessageBlocksProps = Omit<UserMessageProps, "children"> & { blocks: MinimalBlock[] };

/**
 * Extract text content from message blocks
 */
function extractTextFromBlocks(blocks: MinimalBlock[]): string {
  return blocks
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text || "")
    .join("");
}

/**
 * Extract image blocks from message blocks
 */
function extractImagesFromBlocks(blocks: MinimalBlock[]): ImageMessageBlock[] {
  return blocks.filter((b): b is ImageMessageBlock => b.type === "image");
}

/**
 * Extract file blocks from message blocks (PDFs, etc.)
 */
function extractFilesFromBlocks(blocks: MinimalBlock[]): FileMessageBlock[] {
  return blocks.filter((b): b is FileMessageBlock => b.type === "file");
}

export function UserMessage(props: UserMessageProps) {
  const { className } = props;

  // Blocks-based rendering
  if ("blocks" in props && props.blocks) {
    const textContent = extractTextFromBlocks(props.blocks);
    const imageBlocks = extractImagesFromBlocks(props.blocks);
    const fileBlocks = extractFilesFromBlocks(props.blocks);

    return (
      <div data-role="user" className="flex flex-col items-end">
        {textContent && (
          <div
            data-testid="user-message"
            data-role="user"
            className={twMerge(
              "bg-neutral-100 rounded-2xl px-4 py-3 max-w-[80%] ml-auto",
              className
            )}
          >
            <p className="text-neutral-900 whitespace-pre-wrap text-sm">{textContent}</p>
          </div>
        )}
        {imageBlocks.length > 0 && <MessageImages images={imageBlocks} />}
        {fileBlocks.length > 0 && <MessageDocuments files={fileBlocks} />}
      </div>
    );
  }

  // Simple children-based rendering (backwards compatible)
  return (
    <div
      data-testid="user-message"
      data-role="user"
      className={twMerge(
        "bg-neutral-100 rounded-2xl px-4 py-3 max-w-[80%] ml-auto",
        className
      )}
    >
      <p className="text-neutral-900 whitespace-pre-wrap text-sm">{props.children}</p>
    </div>
  );
}

// Also re-export MessageImages and MessageDocuments for standalone use
UserMessage.Images = MessageImages;
UserMessage.Documents = MessageDocuments;
