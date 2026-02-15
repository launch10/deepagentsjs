export const InstructionTypes = ["website", "googleAds"] as const;
export type InstructionType = (typeof InstructionTypes)[number];

export type Instructions = Partial<Record<InstructionType, boolean>>;

export const shouldDeployWebsite = (state: {instructions: Instructions}) => {
    return state.instructions?.website ?? false;
}

export const shouldDeployGoogleAds = (state: {instructions: Instructions}) => {
    return state.instructions?.googleAds ?? false;
}

export const shouldDeployAnything = (state: {instructions: Instructions}) => {
    return (state.instructions?.website ?? false) || (state.instructions?.googleAds ?? false);
}

export type { Status } from "../core";
export { Statuses } from "../core";