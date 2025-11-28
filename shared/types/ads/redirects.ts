import { StageNames } from "./assets";

export const Redirects = [...StageNames, "deploy"] as const;
export type RedirectType = typeof Redirects[number];