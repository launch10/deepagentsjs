import { Auth, HTTPException } from "@langchain/langgraph-sdk/auth";
import jwt from "jsonwebtoken";
import cookie from "cookie";

// Make sure JWT_SECRET is set in your environment!
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set!");
}

const JWT_COOKIE_NAME = "jwt"; // Exactly matches what Rails sets in SessionsController

async function verifyToken(token: string | undefined): Promise<string> {
  if (!token) {
    throw new Error("Token not provided");
  }
  try {
    // Adjust 'sub' if your Rails JWT uses a different claim for user ID
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; [key: string]: any };
    debugger;
    if (!decoded.sub) { // 'sub' is standard for subject/userId
        throw new Error("Token does not contain user identifier (sub claim)");
    }
    return decoded.sub; // Assuming 'sub' claim holds the user ID
  } catch (err) {
    console.error("Token verification failed:", err);
    // Don't leak internal error details unless necessary for debugging
    // The HTTPException in the authenticate handler will handle the 401
    throw new Error("Invalid token");
  }
}

export const auth = new Auth()
  .authenticate(async (request: Request) => {
    const authorization = request.headers.get("authorization");
    const token = authorization?.split(" ").at(-1);

    debugger;
    if (!token) {
      throw new HTTPException(401, { message: "Authentication header not found" });
    }

    try {
      const userId = await verifyToken(token);
      console.log(`[Auth] User ${userId} authenticated successfully.`);
      return userId; // This will be available as `user.identity` in subsequent handlers
    } catch (error: any) {
      // `verifyToken` throws an error if validation fails
      console.error("[Auth] Authentication failed:", error.message);
      throw new HTTPException(401, { message: "Invalid or expired token", cause: error });
    }
  })
  .on("*", ({ value, user }) => {
    // This is a generic hook for all resource types.
    // 'user' object here will have an 'identity' property which is the userId returned by authenticate.
    console.log(`[Auth ON *] Processing resource for user: ${user.identity}`);

    // Add owner to the resource metadata if the resource has a metadata field
    if (value && typeof value === 'object' && "metadata" in value && typeof value.metadata === 'object') {
      value.metadata ??= {}; // Ensure metadata object exists
      (value.metadata as { [key: string]: any }).owner = user.identity;
    } else if (value && typeof value === 'object' && !("metadata" in value)) {
      // If metadata field doesn't exist, you might want to create it
      // (value as { metadata?: object }).metadata = { owner: user.identity };
      // Or decide not to add owner if metadata is not a primary concept for this resource
      console.warn("[Auth ON *] Resource does not have a 'metadata' field. Owner not set on resource itself.");
    }


    // Example: Filter resources by owner.
    // This tells LangGraph: "when listing/querying resources of any type,
    // only show those where the 'owner' field matches the current user's identity."
    // The actual field name ('owner' here) must match how you store it in your LangGraph data.
    return { owner: user.identity };
  })
  .on("store", ({ user, value }) => {
    // This hook is specific to operations on the "store" (LangGraph's key-value store).
    // 'value' here is an object like { namespace, key, value (the data being stored) }
    console.log(`[Auth ON store] User ${user.identity} attempting to operate on store namespace: ${value.namespace}`);

    // Example: If your store namespaces are structured like [userId, resourceType, resourceId]
    if (value.namespace && Array.isArray(value.namespace)) {
      const [ownerIdInNamespace] = value.namespace;
      if (ownerIdInNamespace !== user.identity) {
        console.warn(`[Auth ON store] Forbidden: User ${user.identity} tried to access namespace starting with ${ownerIdInNamespace}`);
        throw new HTTPException(403, { message: "Not authorized to access this store namespace" });
      }
    } else {
      // If namespace isn't structured this way, you might have different logic or allow it.
      // For example, you might want to ensure all writes to the store are namespaced under the user's ID by default.
      console.warn(`[Auth ON store] Store namespace is not an array or is null. Authorization rules might not apply as expected for user ${user.identity}. Namespace: ${value.namespace}`);
    }
    // Note: This example assumes you prepend the userId to the namespace.
    // If you don't want to modify the namespace and rely on the `owner` metadata from the "*" hook,
    // you might not need specific rules here, or your rules would be different.
  });