import { create } from "zustand";
import type { LaunchFormData } from "@components/ads/forms/launch-form/launchForm.schema";
import { launchFormDefaults } from "@components/ads/forms/launch-form/launchForm.schema";

interface LaunchFormStore {
  values: LaunchFormData;
  setValues: (values: Partial<LaunchFormData>) => void;
  resetValues: () => void;
}

export const useLaunchFormStore = create<LaunchFormStore>((set) => ({
  values: launchFormDefaults,
  setValues: (values) =>
    set((state) => ({
      values: { ...state.values, ...values },
    })),
  resetValues: () => set({ values: launchFormDefaults }),
}));
