import { WebsiteExporter } from "@services";

/**
 * Save a website from the current test to the examples directory.
 * Call this before cleanup to preserve interesting generations.
 *
 * NOTE: This is a no-op in CI environments (when CI env var is set).
 *
 * @example
 * ```ts
 * it("generates a great landing page", async () => {
 *   const result = await testGraph<WebsiteGraphState>()
 *     .withGraph(websiteGraph)
 *     .withState({ websiteId })
 *     .execute();
 *
 *   // Save this generation before cleanup
 *   await saveExample(websiteId, "scheduling-tool");
 *
 *   expect(result.state.status).toBe("completed");
 * });
 * ```
 */
export async function saveExample(
  websiteId: number,
  name: string,
  options?: { overwrite?: boolean }
): Promise<void> {
  if (process.env.CI) {
    return;
  }

  const result = await WebsiteExporter.export({
    websiteId,
    name,
    overwrite: options?.overwrite ?? true, // Default to overwrite in tests
  });

  console.log(`\n📦 Saved example: ${result.exportPath} (${result.fileCount} files)`);
}
