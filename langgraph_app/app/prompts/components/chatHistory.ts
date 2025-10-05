import { renderPrompt } from '@prompts';

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
export async function chatHistoryPrompt({ messages }: { messages: { role: string; content: string }[] }): Promise<string> {
  const messageElements = messages?.map(({ role, content }) => 
    `<message>${role}: ${JSON.stringify(content, null, 4)}</message>`
  ).join('') || '';
  
  return renderPrompt(`<chat-history>${messageElements}</chat-history>`);
}