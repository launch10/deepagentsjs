import { withContext } from "./withContext";
import { withErrorHandling } from "./withErrorHandling";
import { withNotifications } from "./withNotifications";
import { NodeMiddlewareFactory } from "./middlewareFactory";

export const NodeMiddleware = new NodeMiddlewareFactory()
  .addMiddleware("context", withContext)
  .addMiddleware("notifications", withNotifications)
  .addMiddleware("errorHandling", withErrorHandling);

export { getNodeContext } from "./withContext";