export const InstructionTypes = ["website", "googleAds"] as const;
export type InstructionType = (typeof InstructionTypes)[number];

export type Instructions = Partial<Record<InstructionType, boolean>>;

// Simple deploy type: "website" = website only, "campaign" = website + google ads
export const DeployTypes = ["website", "campaign"] as const;
export type DeployType = (typeof DeployTypes)[number];

export function deployTypeToInstructions(deployType: DeployType): Instructions {
  if (deployType === "campaign") return { website: true, googleAds: true };
  return { website: true };
}

export function instructionsToDeployType(instructions: Instructions): DeployType {
  if (instructions.googleAds) return "campaign";
  return "website";
}

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