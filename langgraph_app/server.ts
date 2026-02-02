import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { serve } from "@hono/node-server";
import { adsRoutes } from "./app/server/routes/ads";
import { brainstormRoutes } from "./app/server/routes/brainstorm";
import { deployRoutes } from "./app/server/routes/deploy";
import { documentsRoutes } from "./app/server/routes/documents";
import { websiteRoutes } from "./app/server/routes/website";
import { insightsRoutes } from "./app/server/routes/insights";
import { supportRoutes } from "./app/server/routes/support";
import { jobRunCallbackRoutes } from "./app/server/routes/webhooks/jobRunCallback";
import { clearLlmCacheRoutes } from "./app/server/routes/webhooks/clearLlmCache";
import { errorHandler } from "./app/server/middleware/errorHandler";
import { env } from "./app/core/env";

const app = new Hono();

app.use("*", logger());
app.use("*", prettyJSON());

// CORS origins - use RAILS_PORT from config/services.sh for dynamic port support
const railsPort = env.RAILS_PORT || "3000";
const defaultOrigins =
  env.NODE_ENV === "production"
    ? ["https://launch10.ai"]
    : [`http://localhost:${railsPort}`, `http://127.0.0.1:${railsPort}`];
const allowedOrigins = env.ALLOWED_ORIGINS
  ? [...env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()), ...defaultOrigins]
  : defaultOrigins;

app.use(
  "*",
  cors({
    origin: allowedOrigins,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

app.route("/api/ads", adsRoutes);
app.route("/api/brainstorm", brainstormRoutes);
app.route("/api/deploy", deployRoutes);
app.route("/api/documents", documentsRoutes);
app.route("/api/website", websiteRoutes);
app.route("/api/insights", insightsRoutes);
app.route("/api/support", supportRoutes);
app.route("/", jobRunCallbackRoutes);
app.route("/", clearLlmCacheRoutes);

app.onError(errorHandler);

app.notFound((c) => c.json({ error: "Not Found" }, 404));

const port = parseInt(process.env.PORT || "4000", 10);

export default {
  port,
  fetch: app.fetch,
};

serve({
  fetch: app.fetch,
  port,
});

console.log(`🚀 Hono server running on http://localhost:${port}`);
