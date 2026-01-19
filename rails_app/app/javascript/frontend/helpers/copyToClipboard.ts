/**
 * Copies text to the user's clipboard.
 * Uses the modern Clipboard API with a fallback for older browsers.
 *
 * @param text - The text to copy to the clipboard
 * @returns A promise that resolves when the text has been copied
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
}
