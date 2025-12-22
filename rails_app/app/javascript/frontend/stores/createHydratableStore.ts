import { create } from "zustand";

export interface HydratableStore<T> {
  values: T;
  hasHydrated: boolean;
  setValues: (values: Partial<T>) => void;
  hydrateOnce: (values: T) => boolean;
  reset: () => void;
}

export function createHydratableStore<T extends Record<string, unknown>>(defaults: T) {
  return create<HydratableStore<T>>((set, get) => ({
    values: defaults,
    hasHydrated: false,

    setValues: (values) =>
      set((state) => ({
        values: { ...state.values, ...values },
      })),

    hydrateOnce: (values: T) => {
      if (get().hasHydrated) return false;
      set({ values, hasHydrated: true });
      return true;
    },

    reset: () => set({ values: defaults, hasHydrated: false }),
  }));
}
