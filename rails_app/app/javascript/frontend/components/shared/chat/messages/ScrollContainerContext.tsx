import { createContext, useContext, type RefObject } from "react";

/**
 * Internal context for wiring the scroll container ref from List to ScrollAnchor.
 * Not exported from Chat.tsx — internal plumbing only.
 */
const ScrollContainerContext = createContext<RefObject<HTMLElement | null> | null>(null);

export const ScrollContainerProvider = ScrollContainerContext.Provider;

export function useScrollContainer(): RefObject<HTMLElement | null> | null {
  return useContext(ScrollContainerContext);
}
