import { Auth, HTTPException } from "@langchain/langgraph-sdk/auth";
import jwt from "jsonwebtoken";

const ALLOWED_HOSTS_STRING = process.env.ALLOWED_HOSTS;
let ALLOWED_HOSTS = ALLOWED_HOSTS_STRING ? ALLOWED_HOSTS_STRING.split(',').map(host => host.trim()) : [];

if (ALLOWED_HOSTS_STRING && ALLOWED_HOSTS.length === 0) {
  console.warn("WARN: ALLOWED_HOSTS environment variable is set but contains no hosts after parsing.");
} else if (!ALLOWED_HOSTS_STRING) {
  console.warn("WARN: ALLOWED_HOSTS environment variable is not set. Origin checking will be skipped.");
}

ALLOWED_HOSTS = ALLOWED_HOSTS.concat(["smith.langchain.com"])

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set!");
}

async function verifyToken(token: string | undefined): Promise<{ identity: string }> {
  if (!token) {
    throw new Error("Token not provided");
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: any; [key: string]: any };
    if (decoded.sub === null || typeof decoded.sub === 'undefined') {
        throw new Error("Token does not contain user identifier (sub claim) or it's null/undefined");
    }
    return { identity: String(decoded.sub) };
  } catch (err) {
    console.error("Token verification failed:", err);
    throw new Error("Invalid token");
  }
}

async function verifyOrigin(request: Request): Promise<void> {
  const origin = request.headers.get("Origin")?.replace(/^https?:\/\//, "");

  if (!origin) {
    throw new HTTPException(403, { message: "Forbidden: Origin header is missing." });
  }
  if (!ALLOWED_HOSTS.includes(origin)) {
    throw new HTTPException(403, { message: `Forbidden: Origin ${origin} is not allowed.` });
  }
}

export const auth = new Auth()
  .authenticate(async (request: Request) => {
    await verifyOrigin(request);

    const authorization = request.headers.get("authorization");
    const token = authorization?.split(" ").at(-1);

    if (!token) {
      throw new HTTPException(401, { message: "Authorization header not found" });
    }

    try {
      const { identity } = await verifyToken(token);
      console.log(`[Auth] User ${identity} authenticated successfully.`);
      return { identity: identity }
    } catch (error: any) {
      console.error("[Auth] Authentication failed:", error.message);
      throw new HTTPException(401, { message: "Invalid or expired token", cause: error });
    }
  })
  .on("*", ({ value, user }) => {
    if (value && typeof value === 'object') {
      value.metadata ??= {};
      (value.metadata as { [key: string]: any }).owner = user.identity;
    } else if (value && typeof value === 'object' && !("metadata" in value)) {
      console.warn("[Auth ON *] Resource does not have a 'metadata' field. Owner not set on resource itself.");
    }
    console.log("[Auth ON *] Setting owner to", user.identity);
    return { owner: user.identity };
  })