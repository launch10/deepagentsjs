import { HumanMessage, type BaseMessage } from "@langchain/core/messages";
import type { MessageContent } from "@langchain/core/messages";

/**
 * Pseudo Messages Utility
 *
 * Pseudo messages are messages injected by the system that should:
 * 1. Be visible to the model during inference
 * 2. Be filtered from conversation history before saving
 * 3. Never appear in the user-facing chat UI
 *
 * All pseudo messages are marked with additional_kwargs.isPseudo = true
 */

/**
 * Checks if a message is a pseudo message
 */
export const isPseudoMessage = (msg: BaseMessage): boolean => {
  return !!msg.additional_kwargs?.isPseudo;
};

/**
 * Creates a text-based pseudo message
 */
export const createPseudoMessage = (text: string): HumanMessage => {
  return new HumanMessage({
    content: text,
    additional_kwargs: { isPseudo: true },
  });
};

/**
 * Creates a multimodal pseudo message (e.g., for image injection)
 */
export const createMultimodalPseudoMessage = (
  content: MessageContent
): HumanMessage => {
  return new HumanMessage({
    content,
    additional_kwargs: { isPseudo: true },
  });
};

/**
 * Filters out all pseudo messages from a message array
 */
export const filterPseudoMessages = (messages: BaseMessage[]): BaseMessage[] => {
  return messages.filter((msg) => !isPseudoMessage(msg));
};

/**
 * Injects a pseudo message at the end of the messages array if provided
 */
export const injectPseudoMessage = (
  messages: BaseMessage[],
  pseudoMessage: HumanMessage | null
): BaseMessage[] => {
  return pseudoMessage ? [...messages, pseudoMessage] : messages;
};
