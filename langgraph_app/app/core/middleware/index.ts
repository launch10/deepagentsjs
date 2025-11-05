import { withContext, getNodeContext } from "./withContext";
import { withErrorHandling } from "./withErrorHandling";
import { withNotifications } from "./withNotifications";
import { withCaching, NodeCache } from "./withCaching";
import { withPolly } from "./withPolly";
import { withInterrupt, interruptContext } from "./withInterrupt";
import { NodeMiddlewareFactory } from "./middlewareFactory";
export { type MinimalStateType } from "./types";

export const NodeMiddleware = new NodeMiddlewareFactory()
  .addMiddleware("context", withContext) // Add node name, graph name, etc
  .addMiddleware("interrupt", withInterrupt) // Add interrupt functionality for testing
  .addMiddleware("notifications", withNotifications) // Notify frontend which node is running
  .addMiddleware("error", withErrorHandling) // Error reporting, logging, etc
  .addMiddleware("polly", withPolly) // Hit polly cache before node cache
  .addMiddleware("cache", withCaching) // Hit node cache

export { 
  getNodeContext, 
  NodeMiddlewareFactory,
  NodeCache,
  interruptContext
}