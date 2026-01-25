/**
 * Bridge exports
 *
 * This module provides the app bridge factory and usage middleware.
 * Use createAppBridge in annotation files to create bridges with
 * automatic usage tracking.
 */
export { createAppBridge } from "./factory";
export { usageTrackingMiddleware } from "./middleware";
