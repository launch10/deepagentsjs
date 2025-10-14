import { renderPrompt } from '@prompts';
import { BaseMessage } from "@langchain/core/messages";

/**
 * The chatHistory function renders a <chat-history> tag,
 * listing messages as <message> sub-elements with "role: content".
 *
 * @param messages - An array of message objects with "role" and "content".
 *
 * @example
 * ```ts
 * const messages = [
 *   { role: 'system', content: 'You are a helpful AI assistant.' },
 *   { role: 'user', content: 'Hello!' }
 * ];
 *
 * chatHistory({ messages })
 * ```
 */
export async function chatHistoryPrompt({ messages }: { messages: BaseMessage[] }): Promise<string> {
  const messageElements = messages?.map((message) => {
    const role = (message.constructor.name === "AIMessage") ? "assistant" : "user";
    const content = message.content;

    return `<message>${role}: ${JSON.stringify(content, null, 4)}</message>`;
  }).join('') || '';
  
  return renderPrompt(`<chat-history>${messageElements}</chat-history>`);
}