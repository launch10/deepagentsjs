import type { Context, Next } from "hono";
import { env } from "@core";
import jwt from "jsonwebtoken";

export interface AdminAuthPayload {
  sub: string;
  exp: number;
  iat: number;
  jti: string;
  service: boolean;
}

export const adminAuthMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized: Missing or invalid token" }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AdminAuthPayload;

    if (decoded.sub !== "service" || decoded.service !== true) {
      return c.json({ error: "Unauthorized: Not a service token" }, 401);
    }

    await next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return c.json({ error: "Unauthorized: Token expired" }, 401);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return c.json({ error: "Unauthorized: Invalid token" }, 401);
    }
    return c.json({ error: "Unauthorized" }, 401);
  }
};
