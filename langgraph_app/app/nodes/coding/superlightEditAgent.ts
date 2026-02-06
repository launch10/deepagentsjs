/**
 * Shared file context utilities for coding agents.
 *
 * Used by singleShotEdit to pre-load project files into LLM context.
 */
import { WebsiteFilesBackend } from "@services";

/**
 * Build the file tree string from globInfo results.
 */
export async function buildFileTree(backend: WebsiteFilesBackend): Promise<{
  tree: string;
  allPaths: string[];
}> {
  const files = await backend.globInfo("**/*");
  const allPaths = files.map((f) => f.path);
  const tree = files
    .map((f) => {
      const sizeStr = f.size ? ` (${f.size} bytes)` : "";
      return `${f.path}${sizeStr}`;
    })
    .join("\n");
  return { tree, allPaths };
}

/**
 * Pre-read target files and format them for the system prompt.
 */
export async function preReadFiles(
  backend: WebsiteFilesBackend,
  filePaths: string[]
): Promise<string> {
  const sections: string[] = [];
  for (const fp of filePaths) {
    try {
      const content = await backend.read(fp);
      sections.push(`### ${fp}\n\`\`\`tsx\n${content}\n\`\`\``);
    } catch {
      // File may not exist; skip silently
    }
  }
  return sections.join("\n\n");
}
