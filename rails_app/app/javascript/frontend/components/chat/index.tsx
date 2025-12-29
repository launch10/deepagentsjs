// Re-export all chat compound components
export { UserMessage } from "./UserMessage";
export { AIMessage } from "./AIMessage";
export { Input } from "./Input";
export { MessageList } from "./MessageList";
export { TopicBadge } from "./TopicBadge";
export { CommandButtons } from "./CommandButtons";
export { ThinkingIndicator } from "./ThinkingIndicator";

// Type exports
export type { UserMessageProps } from "./UserMessage";
export type {
  AIMessageContentProps,
  AIMessageBubbleProps,
  AIMessageLoadingProps,
} from "./AIMessage";
export type {
  InputRootProps,
  InputTextareaProps,
  InputSubmitButtonProps,
  InputFileUploadProps,
  InputRefreshButtonProps,
} from "./Input";
export type { MessageListRootProps } from "./MessageList";
export type { TopicBadgeProps, TopicBadgeVariant } from "./TopicBadge";
export type {
  CommandButtonsRootProps,
  CommandButtonProps,
  CommandButtonVariant,
} from "./CommandButtons";
export type { ThinkingIndicatorProps, ThinkingIndicatorVariant } from "./ThinkingIndicator";

// Convenience export for compound component pattern
import { UserMessage } from "./UserMessage";
import { AIMessage } from "./AIMessage";
import { Input } from "./Input";
import { MessageList } from "./MessageList";
import { TopicBadge } from "./TopicBadge";
import { CommandButtons } from "./CommandButtons";
import { ThinkingIndicator } from "./ThinkingIndicator";

export const Chat = {
  UserMessage,
  AIMessage,
  Input,
  MessageList,
  TopicBadge,
  CommandButtons,
  ThinkingIndicator,
};
