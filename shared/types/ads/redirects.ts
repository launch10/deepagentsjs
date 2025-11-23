import { PageNames } from "./assets";

export const Redirects = [...PageNames, "deploy"] as const;
export type RedirectType = typeof Redirects[number];