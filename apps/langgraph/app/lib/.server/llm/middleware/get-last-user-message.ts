import type { LanguageModelV1Prompt } from 'ai';

export function getLastUserMessage({
  prompt,
}: {
  prompt: LanguageModelV1Prompt | undefined;
}): string | undefined {
  const lastMessage = prompt?.at(-1);

  if (lastMessage?.role !== 'user') {
    return undefined;
  }

  return lastMessage.content[0]?.text;
}