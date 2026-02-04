/**
 * Stream Helpers
 *
 * Utilities for consuming and parsing streams in tests.
 */

/**
 * Consume a Response stream and return the full content as a string.
 * Useful for testing streaming endpoints.
 */
export async function consumeStream(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response has no body");

  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}
