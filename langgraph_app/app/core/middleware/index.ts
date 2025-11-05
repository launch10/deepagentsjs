import { withContext, getNodeContext } from "./withContext";
import { withErrorHandling } from "./withErrorHandling";
import { withNotifications } from "./withNotifications";
import { withCaching, NodeCache } from "./withCaching";
import { NodeMiddlewareFactory } from "./middlewareFactory";
export { type MinimalStateType } from "./types";

export const NodeMiddleware = new NodeMiddlewareFactory()
  .addMiddleware("context", withContext)
  .addMiddleware("notifications", withNotifications)
  .addMiddleware("error", withErrorHandling)
  .addMiddleware("cache", withCaching);

export { 
  getNodeContext, 
  NodeMiddlewareFactory,
  NodeCache,
}