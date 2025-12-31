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
//       {/* your message rendering */}
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
  useChatStatus,
  type ChatContextValue,
} from "./ChatContext";

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
} from "./Input";

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
export { UserMessage, type UserMessageProps } from "./UserMessage";
export { AIMessage, type AIMessageContentProps, type AIMessageBubbleProps, type AIMessageLoadingProps } from "./AIMessage";
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
import { Input } from "./Input";
import { Messages } from "./messages";
import { UserMessage } from "./UserMessage";
import { AIMessage } from "./AIMessage";
import { CommandButtons } from "./CommandButtons";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { MessageList } from "./MessageList";

export const Chat = {
  // Provider
  Root,

  // Context-aware compound components
  Input,
  Messages,

  // Primitives (backwards compatible)
  UserMessage,
  AIMessage,
  MessageList,
  CommandButtons,
  ThinkingIndicator,
};
