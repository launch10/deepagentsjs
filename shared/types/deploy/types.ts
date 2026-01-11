export type Instructions = {
    website?: boolean;
    googleAds?: boolean;
}

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