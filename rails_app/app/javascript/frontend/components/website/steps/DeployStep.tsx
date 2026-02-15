import DeployPage from "@pages/Deploy";

/**
 * Website Deploy step — renders the shared Deploy UI.
 * The URL path (/website/deploy) is used by useDeployInstructions() to derive
 * deploy instructions: { website: true, googleAds: false }.
 */
export default function DeployStep() {
  return <DeployPage />;
}
