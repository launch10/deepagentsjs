import { withContext, getNodeContext } from "./withContext";
import { withErrorHandling } from "./withErrorHandling";
import { withNotifications } from "./withNotifications";
import { withPolly } from "./withPolly";
import { withTestInterrupt, registerTestStopCondition, clearTestStopCondition } from "./withTestInterrupt";
import { NodeMiddlewareFactory } from "./middlewareFactory";

export const NodeMiddleware = new NodeMiddlewareFactory()
  .addMiddleware("context", withContext) // Add node name, graph name, etc
  .addMiddleware("notifications", withNotifications) // Notify frontend which node is running
  .addMiddleware("error", withErrorHandling) // Error reporting, logging, etc
  .addMiddleware("polly", withPolly) // Hit polly cache before node cache
  .addMiddleware("testInterrupt", withTestInterrupt); // Interrupt for test stop conditions

export { getNodeContext, NodeMiddlewareFactory, registerTestStopCondition, clearTestStopCondition };
