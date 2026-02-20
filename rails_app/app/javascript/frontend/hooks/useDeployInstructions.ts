import { usePage } from "@inertiajs/react";
import { Deploy } from "@shared";

export function useDeployInstructions(): Deploy.Instructions {
  const deployType = useDeployType();
  return Deploy.deployTypeToInstructions(deployType);
}

export function useDeployType(): Deploy.DeployType {
  const { url } = usePage();
  const isWebsiteOnly = url.includes("/website/deploy");
  return isWebsiteOnly ? "website" : "campaign";
}
