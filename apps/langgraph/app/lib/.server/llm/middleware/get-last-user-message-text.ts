interface PromptParams {
  prompt: any; // You may want to make this more specific based on your actual prompt structure
}

export function getLastUserMessageText({ prompt }: PromptParams): string | null {
  debugger;
  if (!prompt || !Array.isArray(prompt)) {
    return null;
  }

  // Reverse through the messages to find the last user message
  for (let i = prompt.length - 1; i >= 0; i--) {
    const message = prompt[i];
    debugger;
    if (message?.role === 'user') {
      return message.content?.text;
    }
  }

  return null;
}
