// ============================================================================
// Chat Compound Component
// ============================================================================
// A context-aware chat UI system. Wrap your chat with Chat.Root, passing in
// your chat snapshot, and all subcomponents automatically have access to
// messages, composer, status, and actions.
//
// Example:
//   const chat = useBrainstormChat();
//
//   <Chat.Root chat={chat}>
//     <Chat.Messages.List>
//       {messages.map(msg =>
//         msg.role === 'user'
//           ? <Chat.UserMessage key={msg.id} blocks={msg.blocks} />
//           : <Chat.AIMessage.Root key={msg.id}>
//               <Chat.BlockRenderer blocks={msg.blocks} />
//             </Chat.AIMessage.Root>
//       )}
//       <Chat.Messages.StreamingIndicator />
//       <Chat.Messages.ScrollAnchor />
//     </Chat.Messages.List>
//     <Chat.Input.DropZone>
//       <Chat.Input.AttachmentList />
//       <Chat.Input.Textarea placeholder="Type..." />
//       <Chat.Input.FileButton><DocumentPlusIcon /></Chat.Input.FileButton>
//       <Chat.Input.SubmitButton><ArrowUpIcon /></Chat.Input.SubmitButton>
//     </Chat.Input.DropZone>
//   </Chat.Root>
// ============================================================================

// Context and hooks
export {
  ChatProvider,
  useChatContext,
  useChatMessages,
  useChatComposer,
  useChatIsStreaming,
  useChatIsLoading,
  useChatSendMessage,
  useChatSubmit,
  useChatStop,
  useChatStatus,
  type ChatContextValue,
} from "./ChatContext";

// Utility hooks
export { useMessageMetadata, type MessageMetadata } from "./hooks";

// Root provider
export { Root, type RootProps } from "./Root";

// Context-aware input components
export {
  Input,
  Textarea,
  SubmitButton,
  FileButton,
  DropZone,
  AttachmentList,
  type TextareaProps,
  type SubmitButtonProps,
  type FileButtonProps,
  type DropZoneProps,
  type AttachmentListProps,
} from "./input";

// Context-aware message components
export {
  Messages,
  List,
  StreamingIndicator,
  ScrollAnchor,
  type ListProps,
  type StreamingIndicatorProps,
  type ScrollAnchorProps,
} from "./messages";

// Primitive components (no context, just styling)
export { UserMessage, type UserMessageProps, type UserMessageSimpleProps, type UserMessageBlocksProps } from "./UserMessage";
export { AIMessage, type AIMessageRootProps, type AIMessageContentProps, type AIMessageBubbleProps } from "./AIMessage";
export { BlockRenderer, type BlockRendererProps } from "./BlockRenderer";
export { Suggestions, type SuggestionsRootProps, type SuggestionsItemProps } from "./Suggestions";
export { CommandButtons, type CommandButtonsRootProps, type CommandButtonProps, type CommandButtonVariant } from "./CommandButtons";
export { ThinkingIndicator, type ThinkingIndicatorProps, type ThinkingIndicatorVariant } from "./ThinkingIndicator";
export { MessageList, type MessageListRootProps } from "./MessageList";

// Attachment components (shared infrastructure)
export {
  ImageThumbnail,
  FilePill,
  MessageImages,
  BaseAttachmentList,
  BaseDropZone,
  toDisplayAttachment,
  type ChatAttachment,
} from "./attachments";

// ============================================================================
// Compound Component Object
// ============================================================================
// This is the main export - use Chat.Root, Chat.Input.Textarea, etc.

import { Root } from "./Root";
import { Input } from "./input";
import { Messages } from "./messages";
import { UserMessage } from "./UserMessage";
import { AIMessage } from "./AIMessage";
import { BlockRenderer } from "./BlockRenderer";
import { Suggestions } from "./Suggestions";
import { CommandButtons } from "./CommandButtons";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { MessageList } from "./MessageList";

export const Chat = {
  // Provider
  Root,

  // Context-aware compound components
  Input,
  Messages,

  // Primitives
  UserMessage,
  AIMessage,
  BlockRenderer,
  Suggestions,
  MessageList,
  CommandButtons,
  ThinkingIndicator,
};
