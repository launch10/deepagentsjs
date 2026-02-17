export const InstructionTypes = ["website", "googleAds"] as const;
export type InstructionType = (typeof InstructionTypes)[number];

export type Instructions = Partial<Record<InstructionType, boolean>>;

/**
 * Change detection result from validateDeployNode.
 * Records which instruction parts actually have content changes since last deploy.
 * Undefined means change detection hasn't run (treat as "changed").
 */
export type ContentChanged = Partial<Record<InstructionType, boolean>>;

export const shouldDeployWebsite = (state: {instructions: Instructions; contentChanged?: ContentChanged}) => {
    if (!state.instructions?.website) return false;
    // If change detection ran and website hasn't changed, skip
    if (state.contentChanged && state.contentChanged.website === false) return false;
    return true;
}

export const shouldDeployGoogleAds = (state: {instructions: Instructions; contentChanged?: ContentChanged}) => {
    if (!state.instructions?.googleAds) return false;
    // If change detection ran and campaign hasn't changed, skip
    if (state.contentChanged && state.contentChanged.googleAds === false) return false;
    return true;
}

export const shouldDeployAnything = (state: {instructions: Instructions; contentChanged?: ContentChanged}) => {
    return shouldDeployWebsite(state) || shouldDeployGoogleAds(state);
}

export type { Status } from "../core";
export { Statuses } from "../core";