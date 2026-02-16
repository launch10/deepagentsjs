import { usePage } from "@inertiajs/react";
import type { Deploy } from "@shared";

export function useDeployInstructions(): Deploy.Instructions {
  const { url } = usePage();
  const isWebsiteOnly = url.includes("/website/deploy");
  const instructions = {
    website: true,
    googleAds: !isWebsiteOnly,
  };
  return instructions;
}
