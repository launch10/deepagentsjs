import { usePage } from "@inertiajs/react";
import type { Deploy } from "@shared";

export function useDeployInstructions(): Deploy.Instructions {
  const { url } = usePage();
  const isWebsiteOnly = url.includes("/website/deploy");
  return {
    website: true,
    googleAds: !isWebsiteOnly,
  };
}
