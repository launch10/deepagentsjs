import { env } from "@core";

export const CACHE_MODE = env.CACHE_MODE === true;

export const isCacheModeEnabled = (): boolean => CACHE_MODE;
