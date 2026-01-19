export const InstructionTypes = ["website", "googleAds"] as const;
export type InstructionType = (typeof InstructionTypes)[number];

export type Instructions = Partial<Record<InstructionType, boolean>>;

export const shouldDeployWebsite = (state: {deploy: Instructions}) => {
    return state.deploy?.website ?? false;
}

export const shouldDeployGoogleAds = (state: {deploy: Instructions}) => {
    return state.deploy?.googleAds ?? false;
}

export const shouldDeployAnything = (state: {deploy: Instructions}) => {
    return (state.deploy?.website ?? false) || (state.deploy?.googleAds ?? false);
}

export type { Status } from "../core";
export { Statuses } from "../core";