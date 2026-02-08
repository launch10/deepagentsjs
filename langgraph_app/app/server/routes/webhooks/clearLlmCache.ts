import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import { clearLLMCache, env, getLogger } from "@core";

export const clearLlmCacheRoutes = new Hono();

clearLlmCacheRoutes.post("/webhooks/clear_llm_cache", async (c) => {
  const signature = c.req.header("X-Signature");
  const body = await c.req.text();

  if (!verifySignature(body, signature)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  try {
    await clearLLMCache();
    getLogger({ component: "clearLlmCache" }).info("LLM cache cleared");
    return c.json({ success: true });
  } catch (error) {
    getLogger({ component: "clearLlmCache" }).error({ err: error }, "Failed to clear cache");
    return c.json({ error: "Failed to clear cache" }, 500);
  }
});

function verifySignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false;
  if (!env.JWT_SECRET) {
    getLogger({ component: "clearLlmCache" }).error("JWT_SECRET is not configured");
    return false;
  }
  const expected = createHmac("sha256", env.JWT_SECRET).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (e) {
    getLogger({ component: "clearLlmCache" }).error({ err: e }, "Signature comparison failed");
    return false;
  }
}
