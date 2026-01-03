// Context-aware message components
export { List, type ListProps } from "./List";
export { StreamingIndicator, type StreamingIndicatorProps } from "./StreamingIndicator";
export { ScrollAnchor, type ScrollAnchorProps } from "./ScrollAnchor";

// Compound component object for Chat.Messages.* usage
import { List } from "./List";
import { StreamingIndicator } from "./StreamingIndicator";
import { ScrollAnchor } from "./ScrollAnchor";

export const Messages = {
  List,
  StreamingIndicator,
  ScrollAnchor,
};
