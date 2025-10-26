export const RouteTypes = ["brainstorm", "website_builder"] as const;
export type RouteType = typeof RouteTypes[number];

export const isGraphRoute = (route: unknown): route is RouteType => {
    return (typeof route === "string" && route in RouteTypes);
}