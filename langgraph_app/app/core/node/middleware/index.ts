import { withContext } from "./withContext";
import { withErrorHandling } from "./withErrorHandling";
import { withNotifications } from "./withNotifications";
import { withPolly } from "./withPolly";
import { NodeMiddlewareFactory } from "./middlewareFactory";

export const NodeMiddleware = new NodeMiddlewareFactory()
  .addMiddleware("context", withContext) // Add node name, graph name, etc
  .addMiddleware("notifications", withNotifications) // Notify frontend which node is running
  .addMiddleware("error", withErrorHandling) // Error reporting, logging, etc
  .addMiddleware("polly", withPolly) // Hit polly cache before node cache