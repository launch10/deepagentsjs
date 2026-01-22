import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import { clearLLMCache, env } from "@core";

export const clearLlmCacheRoutes = new Hono();

clearLlmCacheRoutes.post("/webhooks/clear_llm_cache", async (c) => {
  const signature = c.req.header("X-Signature");
  const body = await c.req.text();

  if (!verifySignature(body, signature)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  try {
    await clearLLMCache();
    console.log("[clearLlmCache] LLM cache cleared successfully");
    return c.json({ success: true });
  } catch (error) {
    console.error("[clearLlmCache] Failed to clear cache:", error);
    return c.json({ error: "Failed to clear cache" }, 500);
  }
});

function verifySignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false;
  if (!env.JWT_SECRET) {
    console.error("[verifySignature] JWT_SECRET is not configured");
    return false;
  }
  const expected = createHmac("sha256", env.JWT_SECRET).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (e) {
    console.error("[verifySignature] Comparison failed:", e);
    return false;
  }
}
