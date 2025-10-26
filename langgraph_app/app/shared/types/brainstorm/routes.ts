export const RouteTypes = ["askQuestion", "uiHelp", "keepBrainstorming", "proceedToPageBuilder", "seekApproval"] as const;
export type RouteType = typeof RouteTypes[number];

export const isRoute = (route: unknown): route is RouteType => {
    return (typeof route === "string" && route in RouteTypes);
}