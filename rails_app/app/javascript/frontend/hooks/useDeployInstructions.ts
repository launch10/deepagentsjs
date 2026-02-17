import { usePage } from "@inertiajs/react";
import type { Deploy } from "@shared";

export function useDeployInstructions(): Deploy.Instructions {
  const deployType = useDeployType();

  if (deployType === "website") {
    return { website: true };
  } else if (deployType === "google_ads") {
    return { website: true, googleAds: true };
  }

  throw new Error("Invalid deploy type");
}

export function useDeployType(): "website" | "google_ads" {
  const { url } = usePage();
  const isWebsiteOnly = url.includes("/website/deploy");
  return isWebsiteOnly ? "website" : "google_ads";
}