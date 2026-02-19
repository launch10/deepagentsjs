/**
 * Extracts image URLs from message content blocks.
 * Scans human messages in reverse order to find image_url blocks.
 */
export function extractImageUrls(messages: any[]): string[] {
  const urls: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const type = msg?._getType?.() ?? msg?.getType?.();
    if (type !== "human") continue;

    const content = msg.content ?? msg.kwargs?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type === "image_url" && block?.image_url?.url) {
        urls.push(block.image_url.url);
      }
    }
    if (urls.length > 0) break;
  }
  return urls;
}
