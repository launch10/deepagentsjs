import {
  launchFormDefaults,
  type LaunchFormData,
} from "@components/ads/forms/launch-form/launchForm.schema";
import { createHydratableStore } from "./createHydratableStore";

export const useLaunchFormStore = createHydratableStore<LaunchFormData>(launchFormDefaults);
