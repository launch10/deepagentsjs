import type { WebsiteFilesBackend } from "@services";

/**
 * Input types matching Anthropic's native text_editor_20250429 / text_editor_20250728
 * tool call format. These are the exact shapes Claude sends when using the
 * built-in str_replace_based_edit_tool.
 */
export type TextEditorInput =
  | { command: "view"; path: string; view_range?: [number, number] }
  | { command: "str_replace"; path: string; old_str: string; new_str: string }
  | { command: "create"; path: string; file_text: string }
  | { command: "insert"; path: string; insert_line: number; new_str: string };

/**
 * Execute a text editor command against a WebsiteFilesBackend.
 *
 * This bridges Anthropic's native text editor tool (which Claude is trained on)
 * to our virtual filesystem backend. The model sends commands in the native format,
 * and we route them to the appropriate backend operations.
 *
 * Returns a string result (success message or error) to be sent back as a ToolMessage.
 */
export async function executeTextEditorCommand(
  backend: WebsiteFilesBackend,
  input: TextEditorInput
): Promise<string> {
  switch (input.command) {
    case "view":
      return handleView(backend, input);
    case "str_replace":
      return handleStrReplace(backend, input);
    case "create":
      return handleCreate(backend, input);
    case "insert":
      return handleInsert(backend, input);
    default:
      return `Error: Unknown command '${(input as any).command}'`;
  }
}

async function handleView(
  backend: WebsiteFilesBackend,
  input: { path: string; view_range?: [number, number] }
): Promise<string> {
  try {
    const content = await backend.read(input.path);
    const lines = content.split("\n");

    let start = 0;
    let end = lines.length;

    if (input.view_range) {
      start = input.view_range[0] - 1; // 1-indexed to 0-indexed
      end = input.view_range[1] === -1 ? lines.length : input.view_range[1];
    }

    // Format with line numbers (the Anthropic docs recommend this)
    return lines
      .slice(start, end)
      .map((line, i) => `${start + i + 1}: ${line}`)
      .join("\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Error: File not found: ${input.path} (${msg})`;
  }
}

async function handleStrReplace(
  backend: WebsiteFilesBackend,
  input: { path: string; old_str: string; new_str: string }
): Promise<string> {
  if (input.old_str == null || input.new_str == null) {
    return `Error: str_replace requires both old_str and new_str parameters.`;
  }
  const result = await backend.edit(input.path, input.old_str, input.new_str);

  if (result.error) {
    // Parse the deepagents error to return Anthropic-style messages
    if (result.error.includes("not found") || result.error.includes("String not found")) {
      return `Error: No match found for replacement. The old_str was not found in ${input.path}. Please check your text and try again.`;
    }
    if (result.error.includes("appears") && result.error.includes("times")) {
      return `Error: Found multiple matches for replacement text in ${input.path}. Please provide more context to make a unique match.`;
    }
    return `Error: ${result.error}`;
  }

  return "Successfully replaced text at exactly one location.";
}

async function handleCreate(
  backend: WebsiteFilesBackend,
  input: { path: string; file_text: string }
): Promise<string> {
  // Check if file exists by trying to read it
  try {
    await backend.read(input.path);
    return `Error: File already exists at ${input.path}. Use str_replace to modify it.`;
  } catch {
    // File doesn't exist — good, we can create it
  }

  const result = await backend.write(input.path, input.file_text);
  if (result.error) {
    return `Error: ${result.error}`;
  }
  return `Created file ${input.path}.`;
}

async function handleInsert(
  backend: WebsiteFilesBackend,
  input: { path: string; insert_line: number; new_str: string }
): Promise<string> {
  try {
    const content = await backend.read(input.path);
    const lines = content.split("\n");
    const insertIdx = input.insert_line; // 0 = before first line, N = after line N

    lines.splice(insertIdx, 0, input.new_str);
    const newContent = lines.join("\n");

    // Use write to replace full content (backend.write handles existing files)
    const result = await backend.write(input.path, newContent);
    if (result.error) {
      return `Error: ${result.error}`;
    }
    return `Inserted text after line ${input.insert_line} in ${input.path}.`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Error: File not found: ${input.path} (${msg})`;
  }
}
